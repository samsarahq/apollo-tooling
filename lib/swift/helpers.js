"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const change_case_1 = require("change-case");
const Inflector = require("inflected");
const printing_1 = require("../utilities/printing");
const graphql_2 = require("../utilities/graphql");
const builtInScalarMap = {
    [graphql_1.GraphQLString.name]: 'String',
    [graphql_1.GraphQLInt.name]: 'Int',
    [graphql_1.GraphQLFloat.name]: 'Double',
    [graphql_1.GraphQLBoolean.name]: 'Bool',
    [graphql_1.GraphQLID.name]: 'GraphQLID'
};
class Helpers {
    constructor(options) {
        this.options = options;
    }
    typeNameFromGraphQLType(type, unmodifiedTypeName, isOptional) {
        if (type instanceof graphql_1.GraphQLNonNull) {
            return this.typeNameFromGraphQLType(type.ofType, unmodifiedTypeName, false);
        }
        else if (isOptional === undefined) {
            isOptional = true;
        }
        let typeName;
        if (type instanceof graphql_1.GraphQLList) {
            typeName = '[' + this.typeNameFromGraphQLType(type.ofType, unmodifiedTypeName) + ']';
        }
        else if (type instanceof graphql_1.GraphQLScalarType) {
            typeName = this.typeNameForScalarType(type);
        }
        else {
            typeName = unmodifiedTypeName || type.name;
        }
        return isOptional ? typeName + '?' : typeName;
    }
    typeNameForScalarType(type) {
        return (builtInScalarMap[type.name] ||
            (this.options.passthroughCustomScalars
                ? this.options.customScalarsPrefix + type.name
                : graphql_1.GraphQLString.name));
    }
    fieldTypeEnum(type, structName) {
        if (type instanceof graphql_1.GraphQLNonNull) {
            return `.nonNull(${this.fieldTypeEnum(type.ofType, structName)})`;
        }
        else if (type instanceof graphql_1.GraphQLList) {
            return `.list(${this.fieldTypeEnum(type.ofType, structName)})`;
        }
        else if (type instanceof graphql_1.GraphQLScalarType) {
            return `.scalar(${this.typeNameForScalarType(type)}.self)`;
        }
        else if (type instanceof graphql_1.GraphQLEnumType) {
            return `.scalar(${type.name}.self)`;
        }
        else if (graphql_1.isCompositeType(type)) {
            return `.object(${structName}.selections)`;
        }
        else {
            throw new Error(`Unknown field type: ${type}`);
        }
    }
    enumCaseName(name) {
        return change_case_1.camelCase(name);
    }
    operationClassName(name) {
        return change_case_1.pascalCase(name);
    }
    structNameForPropertyName(propertyName) {
        return change_case_1.pascalCase(Inflector.singularize(propertyName));
    }
    structNameForFragmentName(fragmentName) {
        return change_case_1.pascalCase(fragmentName);
    }
    structNameForVariant(variant) {
        return 'As' + variant.possibleTypes.map(type => change_case_1.pascalCase(type.name)).join('Or');
    }
    propertyFromField(field, namespace) {
        const { responseKey, isConditional } = field;
        const propertyName = graphql_2.isMetaFieldName(responseKey) ? responseKey : change_case_1.camelCase(responseKey);
        const structName = printing_1.join([namespace, this.structNameForPropertyName(responseKey)], '.');
        let type = field.type;
        if (isConditional && type instanceof graphql_1.GraphQLNonNull) {
            type = type.ofType;
        }
        const isOptional = !(type instanceof graphql_1.GraphQLNonNull);
        const unmodifiedType = graphql_1.getNamedType(field.type);
        const unmodifiedTypeName = graphql_1.isCompositeType(unmodifiedType) ? structName : unmodifiedType.name;
        const typeName = this.typeNameFromGraphQLType(type, unmodifiedTypeName);
        return Object.assign({}, field, {
            responseKey,
            propertyName,
            typeName,
            structName,
            isOptional
        });
    }
    propertyFromVariant(variant) {
        const structName = this.structNameForVariant(variant);
        return {
            propertyName: change_case_1.camelCase(structName),
            typeName: structName + '?',
            structName,
            selectionSet: variant
        };
    }
    propertyFromFragmentSpread(fragmentSpread, isConditional) {
        const structName = this.structNameForFragmentName(fragmentSpread.fragmentName);
        return Object.assign({}, fragmentSpread, {
            propertyName: change_case_1.camelCase(fragmentSpread.fragmentName),
            typeName: isConditional ? structName + '?' : structName,
            structName,
            isConditional
        });
    }
    propertyFromInputField(field) {
        return Object.assign({}, field, {
            propertyName: change_case_1.camelCase(field.name),
            typeName: this.typeNameFromGraphQLType(field.type),
            isOptional: !(field.type instanceof graphql_1.GraphQLNonNull)
        });
    }
    dictionaryLiteralForFieldArguments(args) {
        function expressionFromValue(value) {
            if (value.kind === 'Variable') {
                return `GraphQLVariable("${value.variableName}")`;
            }
            else if (Array.isArray(value)) {
                return printing_1.wrap('[', printing_1.join(value.map(expressionFromValue), ', '), ']');
            }
            else if (typeof value === 'object') {
                return printing_1.wrap('[', printing_1.join(Object.entries(value).map(([key, value]) => {
                    return `"${key}": ${expressionFromValue(value)}`;
                }), ', ') || ':', ']');
            }
            else {
                return JSON.stringify(value);
            }
        }
        return printing_1.wrap('[', printing_1.join(args.map(arg => {
            return `"${arg.name}": ${expressionFromValue(arg.value)}`;
        }), ', ') || ':', ']');
    }
    mapExpressionForType(type, expression, prefix = '') {
        let isOptional;
        if (type instanceof graphql_1.GraphQLNonNull) {
            isOptional = false;
            type = type.ofType;
        }
        else {
            isOptional = true;
        }
        if (type instanceof graphql_1.GraphQLList) {
            if (isOptional) {
                return `${prefix}.flatMap { $0.map { ${this.mapExpressionForType(type.ofType, expression, '$0')} } }`;
            }
            else {
                return `${prefix}.map { ${this.mapExpressionForType(type.ofType, expression, '$0')} }`;
            }
        }
        else if (isOptional) {
            return `${prefix}.flatMap { ${expression} }`;
        }
        else {
            return expression;
        }
    }
}
exports.Helpers = Helpers;
//# sourceMappingURL=helpers.js.map