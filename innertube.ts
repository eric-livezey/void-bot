import Innertube from 'youtubei.js';

const instance = Innertube.create();

export async function getInnertubeInstance() {
    return await instance;
}
