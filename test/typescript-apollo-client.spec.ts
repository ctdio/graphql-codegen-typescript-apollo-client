import { RawClientSideBasePluginConfig } from '@graphql-codegen/visitor-plugin-common';
import { compileTs } from '@graphql-codegen/testing';
import { plugin } from '../src/index';
import { parse, buildClientSchema, GraphQLSchema } from 'graphql';
import { Types, mergeOutputs } from '@graphql-codegen/plugin-helpers';
import { plugin as tsPlugin } from '@graphql-codegen/typescript';
import { readFileSync } from 'fs';

const { plugin: tsDocumentsPlugin } = require('@graphql-codegen/typescript-operations');

describe('typescript-apollo-client', () => {
  const schema = buildClientSchema(JSON.parse(readFileSync(`${__dirname}/__fixtures__/githunt/schema.json`).toString()));

  const basicDoc = parse(/* GraphQL */ `
    query feed {
      feed {
        id
        commentCount
        repository {
          owner {
            avatar_url
          }
        }
      }
    }

    query feed2($v: String!) {
      feed {
        id
      }
    }

    query feed3($v: String) {
      feed {
        id
      }
    }

    query feed4($v: String! = "TEST") {
      feed {
        id
      }
    }
  `);

  describe('sdk', () => {
    it('Should generate a correct wrap method', async () => {
      const config = {};
      const docs = [{ filePath: '', content: basicDoc }];
      const result = (await plugin(schema, docs, config, {
        outputFile: 'graphql.ts',
      })) as Types.ComplexPluginOutput;

      const usage = `
async function test() {
  const apolloClient = new ApolloClient({
    uri: 'https://test.gg/graphql'
  });

  const sdk = getSdk(apolloClient);

  await sdk.feed();
  await sdk.feed3();
  await sdk.feed4();

  const result = await sdk.feed2({ v: "1" });

  if (result.feed) {
    if (result.feed[0]) {
      const id = result.feed[0].id
    }
  }
}`;
      const output = await validateAndCompile(result, config, docs, schema, usage);

      expect(output).toMatchSnapshot();
    });
  })
});

async function validateAndCompile (
  content: Types.PluginOutput,
  config: RawClientSideBasePluginConfig,
  docs: Types.DocumentFile[],
  pluginSchema: GraphQLSchema,
  usage = ''
) {
  const m = mergeOutputs([
    await tsPlugin(pluginSchema, docs, config, { outputFile: '' }),
    await tsDocumentsPlugin(pluginSchema, docs, config, { outputFile: '' }), content, usage]
  );

  await compileTs(m);

  return m;
};
