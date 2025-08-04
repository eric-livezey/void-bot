import { SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { CommandContext, InteractionContext, MessageContext } from "../../context";
import { Command } from "..";

const OPERATORS = new Set(['^', '*', '/', '%', '+', '-', 'E']);
const DELIMITERS = new Set([...OPERATORS, '(', ')']);
const FUNCTIONS = new Set(['sqrt', 'cbrt', 'cos', 'sin', 'tan', 'acos', 'asin', 'atan', 'cosh', 'sinh', 'tanh', 'ln', 'log']);
const NUMBER_REGEXP = /^\d+(\.\d+)?$/;
const WHITESPACE_REGEXP = /^\s*$/;
const DELIMITER_REGEXP = /[()^*/%+E-]/;

/**
 * Returns the predence of an operator.
 * 
 * @param operator An operator.
 */
function precedenceOf(operator: string) {
    switch (operator) {
        case 'E':
            return 4;
        case '^':
            return 3; // not exactly
        case '*':
        case '/':
        case '%':
            return 2;
        case '+':
        case '-':
            return 1;
        case '(':
            return 0;
        default:
            throw new Error("Unexpected operator: " + operator);
    };
}

/**
 * Applies a mathematic function on an value.
 * 
 * @param func A function.
 * @param value A number.
 * @returns 
 */
function applyFunction(func: string, value: number) {
    switch (func) {
        case "sqrt": return Math.sqrt(value);
        case "cbrt": return Math.cbrt(value);
        case "cos": return Math.cos(value);
        case "sin": return Math.sin(value);
        case "tan": return Math.tan(value);
        case "acos": return Math.acos(value);
        case "asin": return Math.asin(value);
        case "atan": return Math.atan(value);
        case "cosh": return Math.cosh(value);
        case "sinh": return Math.sinh(value);
        case "tanh": return Math.tanh(value);
        case "ln": return Math.log(value);
        case "log": return Math.log10(value);
        default: throw new Error("Unexpected function: " + func);
    };
}

/**
 * Applies a mathematical operation on two operands.
 * 
 * @param operator An operator.
 * @param leftOperand The left operand.
 * @param rightOperand The right operand.
 */
function applyOperation(operator: string, leftOperand: number, rightOperand: number) {
    switch (operator) {
        case 'E': return leftOperand * Math.pow(10, rightOperand);
        case '^': return Math.pow(leftOperand, rightOperand);
        case '*': return leftOperand * rightOperand;
        case '/': return leftOperand / rightOperand;
        case '%': return leftOperand % rightOperand;
        case '+': return leftOperand + rightOperand;
        case '-': return leftOperand - rightOperand;
        default: throw new Error("Unexpected operator: " + operator);
    };
}

/**
 * Evaluates a mathematical expression.
 * 
 * **NOTE**: Exponents are evaluated left to right when they should be right to left
 * 
 * @param {string} expression a mathematical expression
 */
export function evaluate(expression: string) {
    const regexp = RegExp(DELIMITER_REGEXP.source, 'g');
    const operands: number[] = [];
    const operators: string[] = [];
    const history: string[] = [];
    // while there are still tokens
    let lastIndex: number | null = 0;
    while (lastIndex != null) {
        // resolve token
        const match = regexp.exec(expression);
        let startIndex = lastIndex, endIndex;
        if (match) {
            endIndex = match.index;
            lastIndex = endIndex + match[0].length;
        } else {
            lastIndex = null;
        }
        const tokens = [expression.slice(startIndex, endIndex).trim()];
        if (match) {
            // add delimiter is applicable
            tokens.push(match[0]);
        }
        // for each token
        for (const token of tokens) {
            // evaluate token
            if (token.match(WHITESPACE_REGEXP)) {
                // token is ignored
                continue;
            } else if (NUMBER_REGEXP.test(token)) {
                // token is a number
                if (history.length >= 2 && history[history.length - 1] === '-' && DELIMITERS.has(history[history.length - 2])) {
                    // number is negative
                    operands.push(Number(operators.pop()! + token));
                } else if (operands.length !== 0 && operators.length === 0) {
                    // missing operators
                    throw new Error(`Misplaced operands: "${expression}"`);
                } else {
                    operands.push(Number(token));
                }
            } else if (token === 'pi') {
                // token is pi
                operands.push(Math.PI);
            } else if (token === 'e') {
                // token is e
                operands.push(Math.E);
            } else if (token === '(' || FUNCTIONS.has(token)) {
                // token is an opening parenthesis or a function
                if (operands.length !== 0 && operators.length === 0) {
                    // missing operators
                    throw new Error(`Misplaced operands: "${expression}"`);
                }
                operators.push(token);
            } else if (token === ')') {
                // token is closing parenthesis
                // apply operations in the parenthesis
                while (operators.length !== 0 && operators[operators.length - 1] !== '(') {
                    const rightOperand = operands.pop();
                    if (rightOperand == null) {
                        // missing operands
                        throw new Error(`Missing operands: "${expression}"`);
                    }
                    const leftOperand = operands.pop();
                    if (leftOperand == null) {
                        // missing operands
                        throw new Error(`Missing operands: "${expression}"`);
                    }
                    operands.push(applyOperation(operators.pop()!, leftOperand, rightOperand));
                }
                if (operators.length === 0) {
                    // missing opening parenthsis
                    throw new Error(`Unbalanced parenthesis: "${expression}"`);
                }
                operators.pop();
                if (operators.length !== 0 && FUNCTIONS.has(operators[operators.length - 1])) {
                    // previous operator is a function
                    operands.push(applyFunction(operators.pop()!, operands.pop()!));
                }
            } else if (OPERATORS.has(token)) {
                // token is an operator
                // apply operations with greater or equal precedence to the token
                while (operators.length !== 0 && precedenceOf(operators[operators.length - 1]) >= precedenceOf(token)) {
                    const rightOperand = operands.pop()!;
                    const leftOperand = operands.pop();
                    if (leftOperand == null) {
                        // missing operand
                        throw new Error(`Misplaced operators: "${expression}"`);
                    }
                    operands.push(applyOperation(operators.pop()!, leftOperand, rightOperand));
                }
                operators.push(token);
            } else {
                // invalid token
                throw new Error(`Unexpected token: "${token}"`);
            }
            history.push(token);
        }
    }
    // apply remaining operations
    while (operators.length !== 0) {
        const operator = operators.pop()!;
        if (operator === '(') {
            // unbalances parentheis
            throw new Error(`Unbalanced parenthesis: "${expression}"`);
        }
        const rightOperand = operands.pop();
        if (rightOperand == null) {
            // missing operand
            throw new Error(`Missing operands: "${expression}"`);
        }
        const leftOperand = operands.pop()!;
        if (leftOperand == null) {
            // no left operand
            if (operator === '-') {
                // operand is negative
                operands.push(rightOperand * -1);
                continue;
            } else {
                // missing operand
                throw new Error(`Missing operands: "${expression}"`);
            }
        }
        operands.push(applyOperation(operator, leftOperand, rightOperand));
    }
    return operands.pop() ?? 0;
}

export async function execute(ctx: CommandContext, expression: string) {
    try {
        const result = evaluate(expression);
        await ctx.reply(result.toLocaleString());
    } catch (error) {
        await ctx.reply((error as Error).message);
    }
}

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('evaluate')
            .setDescription('Evaluate a mathematical expression.')
            .addStringOption(new SlashCommandStringOption()
                .setName('expression')
                .setDescription('A mathematical expression.')
                .setRequired(true)),
        async execute(ctx: InteractionContext) {
            const options = ctx.interaction.options;

            const input = options.getString('expression', true);

            await execute(ctx, input);
        }
    },
    message: [
        {
            aliases: ['evaluate', 'eval'],
            isDmRestricted: true,
            async execute(ctx: MessageContext) {
                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('`expression` must be provided.');
                    return;
                }

                await execute(ctx, input);
            }
        }
    ]
} as Command;
