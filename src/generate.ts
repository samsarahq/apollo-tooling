import * as fs from 'fs';

import { loadSchema, loadAndMergeQueryDocuments } from './loading';
import { validateQueryDocument } from './validation';
import { compileToIR } from './compiler';
import { compileToLegacyIR } from './compiler/legacyIR';
import serializeToJSON from './serializeToJSON';
import { generateSource as generateSwiftSource } from './swift';
import { generateSource as generateTypescriptSource } from './typescript';
import { generateSource as generateFlowSource } from './flow';
import { generateSource as generateScalaSource } from './scala';

type TargetType = 'json' | 'swift' | 'ts' | 'typescript' | 'flow' | 'scala';

export default function generate(
  inputPaths: string[],
  schemaPath: string,
  outputPath: string,
  target: TargetType,
  tagName: string,
  options: any
) {
  const schema = loadSchema(schemaPath);

  const document = loadAndMergeQueryDocuments(inputPaths, tagName);

  validateQueryDocument(schema, document);

  let output;

  if (target === 'swift') {
    options.addTypename = true;
    const context = compileToIR(schema, document, options);
    output = generateSwiftSource(context);
    if (options.generateOperationIds) {
      writeOperationIdsMap(context);
    }
  } else {
    const context = compileToLegacyIR(schema, document, options);
    switch (target) {
      case 'json':
        output = serializeToJSON(context);
        break;
      case 'ts':
      case 'typescript':
        output = generateTypescriptSource(context);
        break;
      case 'flow':
        output = generateFlowSource(context);
        break;
      case 'scala':
        output = generateScalaSource(context, options);
    }
  }

  if (outputPath) {
    fs.writeFileSync(outputPath, output);
  } else {
    console.log(output);
  }
}

interface OperationIdsMap {
  name: string;
  source: string;
}

function writeOperationIdsMap(context: any) {
  let operationIdsMap: { [id: string]: OperationIdsMap } = {};
  Object.values(context.operations as Array<any>).forEach(operation => {
    operationIdsMap[operation.operationId] = {
      name: operation.operationName,
      source: operation.sourceWithFragments
    };
  });
  fs.writeFileSync(context.operationIdsPath, JSON.stringify(operationIdsMap, null, 2));
}
