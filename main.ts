import ts from "typescript";
import * as fs from "fs";
import * as readline from "readline";
import { ChatGPTAPI } from "chatgpt";
import {
  CLASS_PROMPT,
  FIELD_PROMPT,
  FUNC_PROMPT,
  INTERFACE_PROMPT,
  TYPE_PROMPT,
} from "./prompts.js";

if (!process.env.CHATGPT_API_KEY) {
  throw new Error(
    "You need to set CHATGPT_API_KEY with a GPT API key. If a hassle, you can bug Adam for his."
  );
}

export const api = new ChatGPTAPI({
  apiKey: process.env.CHATGPT_API_KEY,
  completionParams: {
    model: "gpt-4",
  },
  maxModelTokens: 7192, // Must equal maxModelTokens + maxReponseTokens <= 8192
  maxResponseTokens: 1000,
});

function extractSnippet(sourceCode: string, pos: number) {
  const maxLength = 7192 * 3;
  const halfLength = Math.floor(maxLength / 2);

  if (sourceCode.length <= maxLength) {
    return sourceCode;
  }

  let start = pos - halfLength;
  let end = pos + halfLength;

  if (start < 0) {
    end -= start;
    start = 0;
  }

  if (end > sourceCode.length) {
    const diff = end - sourceCode.length;
    start -= diff;
    end = sourceCode.length;
    if (start < 0) {
      start = 0;
    }
  }

  return sourceCode.substring(start, end);
}

let sourceCode: string;
async function getAIResult(position: number, prompt: string) {
  let writeLength = 0;
  const sourceCodeSnippet = extractSnippet(sourceCode, position);
  const res = await api.sendMessage(prompt, {
    systemMessage: `Work on this source code: ${sourceCodeSnippet}`,
    onProgress(partialResponse) {
      let output = partialResponse.text;
      let newOutput = output.substring(writeLength);
      writeLength = output.length;
      process.stdout.write(newOutput);
    },
  });
  return res.text;
}

const promiseQueue: Array<
  () => Promise<{ pos: number; jsdoc: string } | null>
> = [];

function addJSDoc(node: ts.Node, sourceFile: ts.SourceFile) {
  const conditionPromptPairs = [
    [ts.isClassDeclaration(node), CLASS_PROMPT],
    [ts.isMethodDeclaration(node), FUNC_PROMPT],
    [ts.isFunctionDeclaration(node), FUNC_PROMPT],
    [ts.isInterfaceDeclaration(node), INTERFACE_PROMPT],
    [ts.isPropertyDeclaration(node), FIELD_PROMPT],
    [ts.isPropertySignature(node), FIELD_PROMPT],
    [ts.isParameterPropertyDeclaration(node, node.parent), FIELD_PROMPT],
    [ts.isTypeAliasDeclaration(node), TYPE_PROMPT],
  ] as const;
  for (const [cond, promptFn] of conditionPromptPairs) {
    if (cond) {
      const name = (node as any).name?.getText(sourceFile);
      if (!name) {
        return;
      }
      // Hacky code to narrow down to public fields
      if (
        ts.isPropertyDeclaration(node) ||
        ts.isParameterPropertyDeclaration(node, node.parent)
      ) {
        let isPublic = false;
        for (const modifier of node.modifiers || []) {
          if (modifier.kind === ts.SyntaxKind.PublicKeyword) {
            isPublic = true;
            break;
          }
        }
        if (!isPublic) {
          return;
        }
      }

      promiseQueue.push(async () => {
        const existingJSDoc = ts.getLeadingCommentRanges(sourceCode, node.pos);

        if (!existingJSDoc || existingJSDoc.length === 0) {
          const jsdoc = (await getAIResult(node.pos, promptFn(name))).trim();
          return { pos: node.pos, jsdoc };
        }
        return null;
      });
    }
  }

  ts.forEachChild(node, (childNode) => addJSDoc(childNode, sourceFile));
}

async function updateSourceFile(sourceFilePath: string) {
  sourceCode = fs.readFileSync(sourceFilePath).toString();
  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    sourceCode,
    ts.ScriptTarget.ESNext,
    true
  );
  promiseQueue.length = 0;

  addJSDoc(sourceFile, sourceFile);

  const jsdocUpdates: any[] = [];
  for (const p of promiseQueue) {
    const update = await p();
    if (update) {
      jsdocUpdates.push(update);
    }
  }

  // Sort updates by position in descending order
  jsdocUpdates.sort((a, b) => b.pos - a.pos);

  // Apply updates to the source code
  for (const { pos, jsdoc } of jsdocUpdates) {
    // Find the first non-whitespace character before the node position
    let adjustedPos = pos;
    while (adjustedPos > 0 && /\s/.test(sourceCode[adjustedPos])) {
      adjustedPos++;
    }

    sourceCode =
      sourceCode.slice(0, adjustedPos) +
      jsdoc +
      "\n" +
      sourceCode.slice(adjustedPos);
  }

  if (jsdocUpdates.length > 0) {
    fs.writeFileSync(sourceFilePath, sourceCode);
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  for (const fileName of process.argv.slice(2)) {
    //await new Promise<void>((resolve) =>
    //  rl.question(`Press Enter to process ${fileName}.`, () => {
    //    resolve();
    //  })
    //);
    console.log("considering " + fileName);
    // Use the function to update a TypeScript file
    await updateSourceFile(fileName);
  }
}
main();
