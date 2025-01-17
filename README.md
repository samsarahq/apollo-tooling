# The purpose of this fork

The purpose of this forked repository is to generate more correct Typescript types for GraphQL fields decorated with the skip/include directives. The changes add `| null` to type definitions where skip/include directives exist, as there is no guarantee the fields will be included during execution. These fixes are built with versions pre v0.17 since large, backwards incompatible changes were made in v0.17.

Note:
As of November 2021, this issue still does not seem to be resolved on even their latest version (apollo-codegen-typescript v0.40.7).
A Github Issue about this was opened in January 2019 and can be tracked [here](https://github.com/apollographql/apollo-tooling/issues/888).
Once a fix has been included, upgrading to the latest version of apollo tooling would be best. However, note that the backwards incompatible changes made in v0.17 will make upgrading difficult for consumers of prior versions.

# Apollo GraphQL code generator

[![GitHub license](https://img.shields.io/badge/license-MIT-lightgrey.svg?maxAge=2592000)](https://raw.githubusercontent.com/apollographql/apollo-ios/master/LICENSE) [![npm](https://img.shields.io/npm/v/apollo-codegen.svg)](https://www.npmjs.com/package/apollo-codegen) [![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](http://www.apollostack.com/#slack)

This is a tool to generate API code or type annotations based on a GraphQL schema and query documents.

It currently generates Swift code, TypeScript annotations, Flow annotations, and Scala code, we hope to add support for other targets in the future.

See [Apollo iOS](https://github.com/apollographql/apollo-ios) for details on the mapping from GraphQL results to Swift types, as well as runtime support for executing queries and mutations. For Scala, see [React Apollo Scala.js](https://github.com/apollographql/react-apollo-scalajs) for details on how to use generated Scala code in a Scala.js app with Apollo Client.

## Usage

If you want to experiment with the tool, you can install the `apollo-codegen` command globally:

```sh
npm install -g apollo-codegen
```

### `introspect-schema`

To download a GraphQL schema by sending an introspection query to a server:

```sh
apollo-codegen introspect-schema http://localhost:8080/graphql --output schema.json
```

You can use the `header` option to add additional HTTP headers to the request. For example, to include an authentication token, use `--header "Authorization: Bearer <token>"`.

You can use the `insecure` option to ignore any SSL errors (for example if the server is running with self-signed certificate).

**Note:** The command for downloading an introspection query was named `download-schema` but it was renamed to `introspect-schema` in order to have a single command for introspecting local or remote schemas. The old name `download-schema` is still available is an alias for backward compatibility.

To generate a GraphQL schema introspection JSON from a local GraphQL schema:

```sh
apollo-codegen introspect-schema schema.graphql --output schema.json
```

### `generate`

This tool will generate Swift code by default from a set of query definitions in `.graphql` files:

```sh
apollo-codegen generate **/*.graphql --schema schema.json --output API.swift
```

You can also generate type annotations for TypeScript, Flow, or Scala using the `--target` option:

```sh
# TypeScript
apollo-codegen generate **/*.graphql --schema schema.json --target typescript --output schema.ts
# Flow
apollo-codegen generate **/*.graphql --schema schema.json --target flow --output schema.flow.js
# Scala
apollo-codegen generate **/*.graphql --schema schema.json --target scala --output schema.scala
```

#### `gql` template support

If the source file for generation is a javascript or typescript file, the codegen will try to extrapolate the queries inside the [gql tag](https://github.com/apollographql/graphql-tag) templates.

The tag name is configurable using the CLI `--tag-name` option.

## Typescript and Flow

When using `apollo-codegen` with Typescript or Flow, make sure to add the `__typename` introspection field to every selection set within your graphql operations.

If you're using a client like `apollo-client` that does this automatically for your GraphQL operations, pass in the -`-addTypename` option to `apollo-codegen` to make sure the generated Typescript and Flow types have the `__typename` field as well. This is required to ensure proper type generation support for `GraphQLUnionType` and `GraphQLInterfaceType` fields.

### Why is the \_\_typename field required?

Using the type information from the GraphQL schema, we can infer the possible types for fields. However, in the case of a `GraphQLUnionType` or `GraphQLInterfaceType`, there are multiple types that are possible for that field. This is best modeled using a disjoint union with the `__typename`
as the discriminant.

For example, given a schema:

```graphql
...

interface Character {
  name: String!
}

type Human implements Character {
  homePlanet: String
}

type Droid implements Character {
  primaryFunction: String
}

...
```

Whenever a field of type `Character` is encountered, it could be either a Human or Droid. Human and Droid objects
will have a different set of fields. Within your application code, when interacting with a `Character` you'll want to make sure to handle both of these cases.

Given this query:

```graphql
query Characters {
  characters(episode: NEW_HOPE) {
    name

    ... on Human {
      homePlanet
    }

    ... on Droid {
      primaryFunction
    }
  }
}
```

Apollo Codegen will generate a union type for Character.

```javascript
export type CharactersQuery = {
  characters: Array<
    | {
        __typename: 'Human',
        name: string,
        homePlanet: ?string,
      }
    | {
        __typename: 'Droid',
        name: string,
        primaryFunction: ?string,
      }
  >,
};
```

This type can then be used as follows to ensure that all possible types are handled:

```javascript
function CharacterFigures({ characters }: CharactersQuery) {
  return characters.map((character) => {
    switch (character.__typename) {
      case 'Human':
        return <HumanFigure homePlanet={character.homePlanet} name={character.name} />;
      case 'Droid':
        return <DroidFigure primaryFunction={character.primaryFunction} name={character.name} />;
    }
  });
}
```

## Contributing

[![Build status](https://travis-ci.org/apollographql/apollo-codegen.svg?branch=master)](https://travis-ci.org/apollographql/apollo-codegen)

Running tests locally:

```
npm install
npm test
```
