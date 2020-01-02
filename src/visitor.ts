import autoBind from 'auto-bind'
import {
  GraphQLSchema,
  Kind,
  OperationDefinitionNode
} from 'graphql'

import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
  indentMultiline,
  RawClientSideBasePluginConfig,
} from '@graphql-codegen/visitor-plugin-common';

interface OperationToInclude {
  node: OperationDefinitionNode;
  documentVariableName: string;
  operationType: string;
  operationResultType: string;
  operationVariablesTypes: string
}

export class ApolloClientVisitor extends ClientSideBaseVisitor<
  RawClientSideBasePluginConfig,
  ClientSideBasePluginConfig
> {
  private _operationsToInclude: OperationToInclude[] = [];

  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: RawClientSideBasePluginConfig
  ) {
    super(schema, fragments, rawConfig, {});

    autoBind(this);

    this._additionalImports.push(`import { ApolloClient } from 'apollo-client';`);
  }

  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    this._operationsToInclude.push({
      node,
      documentVariableName,
      operationType,
      operationResultType,
      operationVariablesTypes,
    })

    return '';
  }

  public getSdkContent(): string {
    const actions = this._operationsToInclude.map((operation: OperationToInclude) => {
      const optionalVariables =
        !operation.node.variableDefinitions ||
        operation.node.variableDefinitions.length === 0 ||
        operation.node.variableDefinitions.every(
          v => v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue
        );

      const doc = operation.documentVariableName;

      const functionName = operation.node.name.value;

      const variables = `variables${
        optionalVariables ? '?' : ''
      }: ${operation.operationVariablesTypes}`

      const resultType = operation.operationResultType;

      let body: string;

      if (operation.node.operation === 'mutation') {
        const mutationOptions = `{ mutation: ${doc}, variables }`;

        body = `return client.mutate<${resultType}, ${operation.operationVariablesTypes}>(${mutationOptions})`
      } else {
        const queryOptions= `{ query: ${doc}, variables }`;
        body = `return client.query<${resultType}, ${operation.operationVariablesTypes}>(${queryOptions})`
      }

      return indentMultiline(
        `${functionName}(${variables}) {
          ${body}
        }`,
        2
      );
    })

    return `export const getSdk = (client: ApolloClient<any>) => ({
      ${actions.join(',\n')}
    })`;
  }
}
