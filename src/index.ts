import {
  Kind,
  visit,
  concatAST,
  FragmentDefinitionNode,
} from 'graphql'

import { extname } from 'path'

import {
  RawClientSideBasePluginConfig,
  LoadedFragment
} from '@graphql-codegen/visitor-plugin-common';

import { PluginValidateFn, PluginFunction } from '@graphql-codegen/plugin-helpers';
import { ApolloClientVisitor } from './visitor'
export { ApolloClientVisitor } from './visitor'

export const plugin: PluginFunction<RawClientSideBasePluginConfig> = (
  schema,
  documents,
  config
) => {
  const allAst = concatAST(
    documents.reduce((prev, v) => {
      if (v.document) {
        return [...prev, v.document];
      } else {
        return prev;
      }
    }, [])
  );

  const allFragments: LoadedFragment[] = [
    ...(allAst.definitions
      .filter(d => d.kind === Kind.FRAGMENT_DEFINITION) as FragmentDefinitionNode[])
      .map(fragmentDef => ({
        node: fragmentDef,
        name: fragmentDef.name.value,
        onType: fragmentDef.typeCondition.name.value,
        isExternal: false }
      )),
    ...(config.externalFragments || []),
  ];

  const visitor = new ApolloClientVisitor(schema, allFragments, config);
  const visitorResult = visit(allAst, { leave: visitor });

  return {
    prepend: visitor.getImports(),
    content: [
      visitor.fragments,
      ...visitorResult.definitions.filter((t: any) => typeof t === 'string'),
      visitor.getSdkContent()
    ].join('\n')
  }
}

export const validate: PluginValidateFn<any> = (
  _schema,
  _documents,
  _config,
  outputFile,
  _allPlugins
) => {
  if (extname(outputFile) !== '.ts') {
    throw new Error(`Plugin "graphql-codegen-typescript-apollo-client" requires extension to be ".ts"!`);
  }
}
