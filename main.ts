import ts from "typescript";
import * as fs from "fs";
import * as readline from "readline";
import { ChatGPTAPI } from "chatgpt";

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

let sourceCode: string;
const foo = () => {};
async function getAIResult(func: string, x = foo()) {
  let writeLength = 0;
  const res = await api.sendMessage(
    `Provide ONLY an insightful jsdoc comment for '${func}' delimited by /** and */.
    Example: 
    /**
     * Create an AztecAddress instance from a hex-encoded string.
     * The input 'address' should be prefixed with '0x' or not, and have exactly 64 hex characters.
     * Throws an error if the input length is invalid or address value is out of range.
     *
     * @param address - The hex-encoded string representing the Aztec address.
     * @returns An AztecAddress instance.
     */`,
    {
      systemMessage: `Work on this source code: ${sourceCode}`,
      onProgress(partialResponse) {
        let output = partialResponse.text;
        let newOutput = output.substring(writeLength);
        writeLength = output.length;
        process.stdout.write(newOutput);
      },
    }
  );
  return res.text;
}

const promiseQueue: Array<
  () => Promise<{ pos: number; jsdoc: string } | null>
> = [];

function addJSDoc(node: ts.Node, sourceFile: ts.SourceFile) {
  if (
    ts.isClassDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isPropertyDeclaration(node)
  ) {
    const name = (node as any).name?.getText(sourceFile);
    if (!name) {
      return;
    }

    promiseQueue.push(async () => {
      const existingJSDoc = ts.getLeadingCommentRanges(sourceCode, node.pos);

      if (!existingJSDoc || existingJSDoc.length === 0) {
        const jsdoc = (await getAIResult(name)).trim();
        return { pos: node.pos, jsdoc };
      }
      return null;
    });
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
