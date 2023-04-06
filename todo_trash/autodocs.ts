import ts from "typescript";
import * as fs from "fs";
import { api } from "../gpt.js";

let sourceCode: string;

async function getAIResult(func: string) {
  let writeLength = 0;
  const res = await api.sendMessage(
    `Provide the jsdoc comment for '${func}'.`,
    {
      systemMessage: `Work on this source code: ${sourceCode}`,
      onProgress(partialResponse) {
        // Move cursor to the saved position and clear screen from cursor down
        let output = partialResponse.text;
        let newOutput = output.substring(writeLength);
        writeLength = output.length;
        process.stdout.write(newOutput);
      },
    }
  );
  return res.text;
}

const promiseQueue: Array<() => Promise<void>> = [];

function addJSDoc(node: ts.Node, sourceFile: ts.SourceFile) {
  if (
    ts.isClassDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionDeclaration(node)
  ) {
    const name = (node as any).name?.getText(sourceFile);
    if (!name) {
      return;
    }

    promiseQueue.push(async () => {
      const existingJSDoc = ts.getLeadingCommentRanges(sourceCode, node.pos);

      if (!existingJSDoc || existingJSDoc.length === 0) {
        ts.setSyntheticLeadingComments(node, [
          {
            kind: ts.SyntaxKind.MultiLineCommentTrivia,
            text: (await getAIResult(name))
              .replace("/**", "*")
              .replace("*/", ""),
            hasTrailingNewLine: true,
            pos: -1,
            end: -1,
          },
        ]);
      }
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

  addJSDoc(sourceFile, sourceFile);
  for (const p of promiseQueue) {
    await p();
  }

  const printer = ts.createPrinter();
  const newSource = printer.printFile(sourceFile);
  fs.writeFileSync(sourceFilePath, newSource);
}

// Use the function to update a TypeScript file
updateSourceFile(process.argv[2]);
