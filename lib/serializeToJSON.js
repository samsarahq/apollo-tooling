"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
function serializeToJSON(context) {
    return serializeAST({
        operations: Object.values(context.operations),
        fragments: Object.values(context.fragments),
        typesUsed: context.typesUsed.map(serializeType),
    }, '\t');
}
exports.default = serializeToJSON;
function serializeAST(ast, space) {
    return JSON.stringify(ast, function (key, value) {
        if (graphql_1.isType(value)) {
            return String(value);
        }
        else {
            return value;
        }
    }, space);
}
exports.serializeAST = serializeAST;
function serializeType(type) {
    if (type instanceof graphql_1.GraphQLEnumType) {
        return serializeEnumType(type);
    }
    else if (type instanceof graphql_1.GraphQLInputObjectType) {
        return serializeInputObjectType(type);
    }
    else if (type instanceof graphql_1.GraphQLScalarType) {
        return serializeScalarType(type);
    }
}
function serializeEnumType(type) {
    const { name, description } = type;
    const values = type.getValues();
    return {
        kind: 'EnumType',
        name,
        description,
        values: values.map(value => ({
            name: value.name,
            description: value.description,
            isDeprecated: value.isDeprecated,
            deprecationReason: value.deprecationReason
        }))
    };
}
function serializeInputObjectType(type) {
    const { name, description } = type;
    const fields = Object.values(type.getFields());
    return {
        kind: 'InputObjectType',
        name,
        description,
        fields
    };
}
function serializeScalarType(type) {
    const { name, description } = type;
    return {
        kind: 'ScalarType',
        name,
        description
    };
}
//# sourceMappingURL=serializeToJSON.js.map