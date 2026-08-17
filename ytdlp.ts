import { spawn } from "node:child_process";
import { videoURL } from "./utils.js";
import type { Readable } from "node:stream";
import { existsSync, rmSync } from "node:fs";

const _IN_PROGRESS_DOWNLOADS = new Map<string, Promise<void>>();

/**
 * Downloads the audio of a YouTube video to the specified path.
 * 
 * @param videoId A video ID
 * @param path The destination path
 * @param maxRetries Maximum number of times to retry on applicable failures
 */
export function download(videoId: string, path: string, maxRetries = 0): Promise<void> {
    // return current download or create new promise to resolve downloaded audio
    let promise = _IN_PROGRESS_DOWNLOADS.get(videoId);
    if (promise == null) {
        _IN_PROGRESS_DOWNLOADS.set(
            videoId,
            promise = new Promise<void>((resolve, reject) => {
                function handleError(n: number, error: Error) {
                    if (existsSync(path)) {
                        rmSync(path);
                    }
                    if (n > 0) {
                        try {
                            _throwIfNotRetriable(error);
                        } catch (error) {
                            reject(error);
                        }
                        attempt(n - 1);
                    } else {
                        reject(error);
                    }
                }
                function attempt(n: number) {
                    _createStream(videoId, path)
                        .then((stream) => {
                            let isDone = false;
                            // consume yt-dlp's output
                            stream.on('data', () => { });
                            stream.once('error', (error) => {
                                if (isDone) {
                                    return;
                                }
                                isDone = true;
                                handleError(n, error);
                            });
                            stream.once('close', () => {
                                if (isDone) {
                                    return;
                                }
                                isDone = true;

                                if (existsSync(path)) {
                                    resolve();
                                } else if (n > 0) {
                                    attempt(n - 1);
                                } else {
                                    reject(new Error(
                                        'yt-dlp exited without downloading anything'
                                    ));
                                }
                            });
                        })
                        .catch((error) => {
                            handleError(n, error);
                        });
                }
                attempt(maxRetries);
            }).finally(() => {
                _IN_PROGRESS_DOWNLOADS.delete(videoId);
            })
        );
    }
    return promise;
}

/**
 * Creates a readable stream which contains the audio of a YouTube video1.
 * 
 * @param videoId A video ID
 * @param maxRetries Maximum number of times to retry on applicable failures
 * @returns A promise which resolves in a readable stream
 */
export async function createStream(videoId: string, maxRetries = 0): Promise<Readable> {
    for (let n = 0; n < maxRetries; n++) {
        try {
            return await _createStream(videoId);
        } catch (error) {
            _throwIfNotRetriable(error);
        }
    }
    return await _createStream(videoId);
}

// creates a stream to download the audio of a YouTube video using yt-dlp
function _createStream(videoId: string, outputFile = '-'): Promise<Readable> {
    // spawn yt-dlp
    const proc = spawn('yt-dlp', [
        '-f', 'bestaudio',
        '-o', outputFile,
        '--quiet',
        videoId.startsWith('-') ? videoURL(videoId, true) : videoId
    ]);

    const { stdout, stderr } = proc;

    // return a promise which rejects if the stream errors before writing to stdout
    return new Promise((resolve, reject) => {
        let isResolved = false;
        let errorMessage: string | null = null;

        stdout.once('data', (chunk: unknown) => {
            isResolved = true;

            stdout.pause();
            stdout.unshift(chunk);

            resolve(stdout);
        });

        stderr.on('data', (chunk: unknown) => {
            errorMessage = (errorMessage ?? '') + String(chunk);
        });

        proc.once('error', (error) => {
            if (!isResolved) {
                reject(error);
            } else {
                stdout.destroy(error);
            }
        });

        proc.once('close', (code) => {
            const message = errorMessage ?? `yt-dlp exited with code ${code}`;
            if (!isResolved) {
                reject(new Error(message));
            } else if (code !== 0) {
                stdout.destroy(
                    new Error(message)
                );
            }
        });
    });
}

// throws an error if the yt-dlp error is not retriable
function _throwIfNotRetriable(error: unknown): void {
    if (Error.isError(error) && error.message.includes('Sign in to confirm your age')) {
        throw new Error('The video is age-restricted.', { cause: error });
    }
}
