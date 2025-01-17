"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const graphql_2 = require("../utilities/graphql");
function argumentsFromAST(args) {
    return (args &&
        args.map(arg => {
            return { name: arg.name.value, value: graphql_2.valueFromValueNode(arg.value) };
        }));
}
function compileToIR(schema, document, options = {}) {
    if (options.addTypename) {
        document = graphql_2.withTypenameFieldAddedWhereNeeded(document);
    }
    const compiler = new Compiler(schema, options);
    const operations = Object.create(null);
    const fragments = Object.create(null);
    for (const definition of document.definitions) {
        switch (definition.kind) {
            case graphql_1.Kind.OPERATION_DEFINITION:
                const operation = compiler.compileOperation(definition);
                operations[operation.operationName] = operation;
                break;
            case graphql_1.Kind.FRAGMENT_DEFINITION:
                const fragment = compiler.compileFragment(definition);
                fragments[fragment.fragmentName] = fragment;
                break;
        }
    }
    for (const fragmentSpread of compiler.unresolvedFragmentSpreads) {
        const fragment = fragments[fragmentSpread.fragmentName];
        if (!fragment) {
            throw new Error(`Cannot find fragment "${fragmentSpread.fragmentName}"`);
        }
        const possibleTypes = fragment.selectionSet.possibleTypes.filter(type => fragmentSpread.selectionSet.possibleTypes.includes(type));
        fragmentSpread.isConditional = fragment.selectionSet.possibleTypes.some(type => !fragmentSpread.selectionSet.possibleTypes.includes(type));
        fragmentSpread.selectionSet = {
            possibleTypes,
            selections: fragment.selectionSet.selections
        };
    }
    const typesUsed = compiler.typesUsed;
    return { schema, typesUsed, operations, fragments, options };
}
exports.compileToIR = compileToIR;
class Compiler {
    constructor(schema, options) {
        this.unresolvedFragmentSpreads = [];
        this.schema = schema;
        this.options = options;
        this.typesUsedSet = new Set();
    }
    addTypeUsed(type) {
        if (this.typesUsedSet.has(type))
            return;
        if (type instanceof graphql_1.GraphQLEnumType ||
            type instanceof graphql_1.GraphQLInputObjectType ||
            (type instanceof graphql_1.GraphQLScalarType && !graphql_2.isBuiltInScalarType(type))) {
            this.typesUsedSet.add(type);
        }
        if (type instanceof graphql_1.GraphQLInputObjectType) {
            for (const field of Object.values(type.getFields())) {
                this.addTypeUsed(graphql_1.getNamedType(field.type));
            }
        }
    }
    get typesUsed() {
        return Array.from(this.typesUsedSet);
    }
    compileOperation(operationDefinition) {
        if (!operationDefinition.name) {
            throw new Error('Operations should be named');
        }
        const filePath = graphql_2.filePathForNode(operationDefinition);
        const operationName = operationDefinition.name.value;
        const operationType = operationDefinition.operation;
        const variables = (operationDefinition.variableDefinitions || []).map(node => {
            const name = node.variable.name.value;
            const type = graphql_1.typeFromAST(this.schema, node.type);
            this.addTypeUsed(graphql_1.getNamedType(type));
            return { name, type };
        });
        const source = graphql_1.print(operationDefinition);
        const rootType = graphql_2.getOperationRootType(this.schema, operationDefinition);
        return {
            filePath,
            operationName,
            operationType,
            variables,
            source,
            rootType,
            selectionSet: this.compileSelectionSet(operationDefinition.selectionSet, rootType)
        };
    }
    compileFragment(fragmentDefinition) {
        const fragmentName = fragmentDefinition.name.value;
        const filePath = graphql_2.filePathForNode(fragmentDefinition);
        const source = graphql_1.print(fragmentDefinition);
        const type = graphql_1.typeFromAST(this.schema, fragmentDefinition.typeCondition);
        return {
            fragmentName,
            filePath,
            source,
            type,
            selectionSet: this.compileSelectionSet(fragmentDefinition.selectionSet, type)
        };
    }
    compileSelectionSet(selectionSetNode, parentType, possibleTypes = this.possibleTypesForType(parentType), visitedFragments = new Set()) {
        return {
            possibleTypes,
            selections: selectionSetNode.selections
                .map(selectionNode => wrapInBooleanConditionsIfNeeded(this.compileSelection(selectionNode, parentType, possibleTypes, visitedFragments), selectionNode, possibleTypes))
                .filter(x => x)
        };
    }
    compileSelection(selectionNode, parentType, possibleTypes, visitedFragments) {
        switch (selectionNode.kind) {
            case graphql_1.Kind.FIELD: {
                const name = selectionNode.name.value;
                const alias = selectionNode.alias ? selectionNode.alias.value : undefined;
                let hasOperationExclusiveDirectives = false;
                if (selectionNode.directives) {
                    for (const directive of selectionNode.directives) {
                        if (directive.name.value === "skip" || directive.name.value === "include") {
                            hasOperationExclusiveDirectives = true;
                            break;
                        }
                    }
                }
                const args = selectionNode.arguments && selectionNode.arguments.length > 0
                    ? argumentsFromAST(selectionNode.arguments)
                    : undefined;
                const fieldDef = graphql_2.getFieldDef(this.schema, parentType, selectionNode);
                if (!fieldDef) {
                    throw new graphql_1.GraphQLError(`Cannot query field "${name}" on type "${String(parentType)}"`, [
                        selectionNode
                    ]);
                }
                const fieldType = fieldDef.type;
                const unmodifiedFieldType = graphql_1.getNamedType(fieldType);
                this.addTypeUsed(unmodifiedFieldType);
                const { description, isDeprecated, deprecationReason } = fieldDef;
                const responseKey = alias || name;
                let field = {
                    kind: 'Field',
                    responseKey,
                    name,
                    alias,
                    args,
                    type: fieldType,
                    description: !graphql_2.isMetaFieldName(name) && description ? description : undefined,
                    isDeprecated,
                    deprecationReason,
                    hasOperationExclusiveDirectives,
                };
                if (graphql_1.isCompositeType(unmodifiedFieldType)) {
                    const selectionSetNode = selectionNode.selectionSet;
                    if (!selectionSetNode) {
                        throw new graphql_1.GraphQLError(`Composite field "${name}" on type "${String(parentType)}" requires selection set`, [selectionNode]);
                    }
                    field.selectionSet = this.compileSelectionSet(selectionNode.selectionSet, unmodifiedFieldType);
                }
                return field;
            }
            case graphql_1.Kind.INLINE_FRAGMENT: {
                const typeNode = selectionNode.typeCondition;
                const type = typeNode ? graphql_1.typeFromAST(this.schema, typeNode) : parentType;
                const possibleTypesForTypeCondition = this.possibleTypesForType(type).filter(type => possibleTypes.includes(type));
                return {
                    kind: 'TypeCondition',
                    type,
                    selectionSet: this.compileSelectionSet(selectionNode.selectionSet, type, possibleTypesForTypeCondition)
                };
            }
            case graphql_1.Kind.FRAGMENT_SPREAD: {
                const fragmentName = selectionNode.name.value;
                if (visitedFragments.has(fragmentName))
                    return null;
                visitedFragments.add(fragmentName);
                const fragmentSpread = {
                    kind: 'FragmentSpread',
                    fragmentName,
                    selectionSet: {
                        possibleTypes,
                        selections: []
                    }
                };
                this.unresolvedFragmentSpreads.push(fragmentSpread);
                return fragmentSpread;
            }
        }
    }
    possibleTypesForType(type) {
        if (graphql_1.isAbstractType(type)) {
            return this.schema.getPossibleTypes(type) || [];
        }
        else {
            return [type];
        }
    }
}
function wrapInBooleanConditionsIfNeeded(selection, selectionNode, possibleTypes) {
    if (!selection)
        return null;
    if (!selectionNode.directives)
        return selection;
    for (const directive of selectionNode.directives) {
        const directiveName = directive.name.value;
        if (directiveName === 'skip' || directiveName === 'include') {
            if (!directive.arguments)
                continue;
            const value = directive.arguments[0].value;
            switch (value.kind) {
                case 'BooleanValue':
                    if (directiveName === 'skip') {
                        return value.value ? null : selection;
                    }
                    else {
                        return value.value ? selection : null;
                    }
                    break;
                case 'Variable':
                    selection = {
                        kind: 'BooleanCondition',
                        variableName: value.name.value,
                        inverted: directiveName === 'skip',
                        selectionSet: {
                            possibleTypes,
                            selections: [selection]
                        }
                    };
                    break;
            }
        }
    }
    return selection;
}
//# sourceMappingURL=index.js.map