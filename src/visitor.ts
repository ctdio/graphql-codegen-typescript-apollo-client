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
    const actions = this._operationsToInclude.map(({
      node,
      documentVariableName,
      operationType,
      operationResultType,
      operationVariablesTypes,
    }: OperationToInclude) => {
      const optionalVariables =
        !node.variableDefinitions ||
        node.variableDefinitions.length === 0 ||
        node.variableDefinitions.every(
          v => v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue
        );

      const functionName = node.name.value;

      const variables = `variables${
        optionalVariables ? '?' : ''
      }: ${operationVariablesTypes}`

      let body: string;

      if (operationType === 'Mutation') {
        const mutationOptions = `{ mutation: ${documentVariableName}, variables }`;
        body = `return client.mutate<${operationResultType}, ${operationVariablesTypes}>(${mutationOptions})`
      } else if (operationType === 'Query') {
        const queryOptions= `{ query: ${documentVariableName}, variables }`;
        body = `return client.query<${operationResultType}, ${operationVariablesTypes}>(${queryOptions})`
      } else {
        throw new Error(`"${operationType}" operations are not supported.`)
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
