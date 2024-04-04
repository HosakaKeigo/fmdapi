import fs, { ensureDir } from "fs-extra";
import { join } from "path";
import ts, { type Statement } from "typescript";
const createPrinter = ts.createPrinter;
const createSourceFile = ts.createSourceFile;
const factory = ts.factory;
import { FileMakerError, DataApi } from "../index.js";
import { FieldMetaData } from "../client-types.js";
import { F } from "ts-toolbelt";
import chalk from "chalk";
import { ClientObjectProps, isOttoAuth } from "../client.js";
import { memoryStore } from "../tokenStore/memory.js";
import { TokenStoreDefinitions } from "../tokenStore/types.js";

type TSchema = {
  name: string;
  type: "string" | "fmnumber" | "valueList";
  values?: string[];
};

const varname = (name: string) =>
  name.replace(/[^a-zA-Z_]+|[^a-zA-Z_0-9]+/g, "");

const commentHeader = `
/**
* Generated by @proofgeist/fmdapi package
* https://github.com/proofgeist/fmdapi
* DO NOT EDIT THIS FILE DIRECTLY. Changes may be overritten
*/

// @generated
// prettier-ignore
/* eslint-disable */
`;

const importTypeStatement = (
  schemaName: string,
  hasPortals: boolean,
  zod: boolean
) =>
  factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports([
        factory.createImportSpecifier(
          false,
          undefined,
          factory.createIdentifier(`T${schemaName}`)
        ),
        ...(hasPortals
          ? [
              factory.createImportSpecifier(
                false,
                undefined,
                factory.createIdentifier(`T${schemaName}Portals`)
              ),
            ]
          : []),
        ...(zod
          ? [
              factory.createImportSpecifier(
                false,
                undefined,
                factory.createIdentifier(`Z${schemaName}`)
              ),
              ...(hasPortals
                ? [
                    factory.createImportSpecifier(
                      false,
                      undefined,
                      factory.createIdentifier(`Z${schemaName}Portals`)
                    ),
                  ]
                : []),
            ]
          : []),
      ])
    ),
    factory.createStringLiteral(`../${schemaName}`),
    undefined
  );

const exportIndexClientStatement = (schemaName: string) =>
  factory.createExportDeclaration(
    undefined,
    false,
    factory.createNamedExports([
      factory.createExportSpecifier(
        false,
        factory.createIdentifier(`client`),
        factory.createIdentifier(`${schemaName}Client`)
      ),
    ]),
    factory.createStringLiteral(`./${schemaName}`),
    undefined
  );

const importStatement = (wv = false) =>
  factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports([
        factory.createImportSpecifier(
          false,
          undefined,
          factory.createIdentifier("DataApi")
        ),
      ])
    ),
    factory.createStringLiteral(`@proofgeist/fmdapi${wv ? "/dist/wv" : ""}`),
    undefined
  );
const undefinedTypeGuardStatement = (name: string) =>
  factory.createIfStatement(
    factory.createPrefixUnaryExpression(
      ts.SyntaxKind.ExclamationToken,
      factory.createPropertyAccessExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("process"),
          factory.createIdentifier("env")
        ),
        factory.createIdentifier(name)
      )
    ),
    factory.createThrowStatement(
      factory.createNewExpression(
        factory.createIdentifier("Error"),
        undefined,
        [factory.createStringLiteral(`Missing env var: ${name}`)]
      )
    ),
    undefined
  );
const exportClientStatement = (args: {
  fieldTypeName: string;
  portalTypeName?: string;
  schemaName: string;
  layout: string;
  useZod: boolean;
  envNames: Omit<ClientObjectProps, "layout" | "tokenStore">;
  tokenStore?: ts.Expression;
  webviewerScriptName?: string;
}) => [
  importStatement(args.webviewerScriptName !== undefined),
  ...(args.webviewerScriptName !== undefined
    ? []
    : [
        undefinedTypeGuardStatement(args.envNames.db),
        undefinedTypeGuardStatement(args.envNames.server),
        ...(isOttoAuth(args.envNames.auth)
          ? [undefinedTypeGuardStatement(args.envNames.auth.apiKey)]
          : [
              undefinedTypeGuardStatement(args.envNames.auth.username),
              undefinedTypeGuardStatement(args.envNames.auth.password),
            ]),
      ]),
  factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(`client`),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier("DataApi"),
            [
              factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              factory.createTypeReferenceNode(
                factory.createIdentifier(args.fieldTypeName),
                undefined
              ),
              // only add portal type if a portal type was passed
              ...(args.portalTypeName
                ? [
                    factory.createTypeReferenceNode(
                      factory.createIdentifier(args.portalTypeName),
                      undefined
                    ),
                  ]
                : []),
            ],
            [
              factory.createObjectLiteralExpression(
                [
                  ...(args.webviewerScriptName !== undefined
                    ? []
                    : [
                        factory.createPropertyAssignment(
                          factory.createIdentifier("auth"),
                          factory.createObjectLiteralExpression(
                            isOttoAuth(args.envNames.auth)
                              ? [
                                  factory.createPropertyAssignment(
                                    factory.createIdentifier("apiKey"),
                                    factory.createPropertyAccessExpression(
                                      factory.createPropertyAccessExpression(
                                        factory.createIdentifier("process"),
                                        factory.createIdentifier("env")
                                      ),
                                      factory.createIdentifier(
                                        args.envNames.auth.apiKey
                                      )
                                    )
                                  ),
                                ]
                              : [
                                  factory.createPropertyAssignment(
                                    factory.createIdentifier("username"),
                                    factory.createPropertyAccessExpression(
                                      factory.createPropertyAccessExpression(
                                        factory.createIdentifier("process"),
                                        factory.createIdentifier("env")
                                      ),
                                      factory.createIdentifier(
                                        args.envNames.auth.username
                                      )
                                    )
                                  ),
                                  factory.createPropertyAssignment(
                                    factory.createIdentifier("password"),
                                    factory.createPropertyAccessExpression(
                                      factory.createPropertyAccessExpression(
                                        factory.createIdentifier("process"),
                                        factory.createIdentifier("env")
                                      ),
                                      factory.createIdentifier(
                                        args.envNames.auth.password
                                      )
                                    )
                                  ),
                                ],
                            false
                          )
                        ),
                      ]),
                  ...(args.webviewerScriptName !== undefined
                    ? []
                    : [
                        factory.createPropertyAssignment(
                          factory.createIdentifier("db"),
                          factory.createPropertyAccessExpression(
                            factory.createPropertyAccessExpression(
                              factory.createIdentifier("process"),
                              factory.createIdentifier("env")
                            ),
                            factory.createIdentifier(args.envNames.db)
                          )
                        ),
                      ]),
                  ...(args.webviewerScriptName !== undefined
                    ? []
                    : [
                        factory.createPropertyAssignment(
                          factory.createIdentifier("server"),
                          factory.createPropertyAccessExpression(
                            factory.createPropertyAccessExpression(
                              factory.createIdentifier("process"),
                              factory.createIdentifier("env")
                            ),
                            factory.createIdentifier(args.envNames.server)
                          )
                        ),
                      ]),
                  factory.createPropertyAssignment(
                    factory.createIdentifier("layout"),
                    factory.createStringLiteral(args.layout)
                  ),
                  ...(args.tokenStore && args.webviewerScriptName === undefined
                    ? [
                        factory.createPropertyAssignment(
                          factory.createIdentifier("tokenStore"),
                          args.tokenStore
                        ),
                      ]
                    : []),
                  ...(args.webviewerScriptName !== undefined
                    ? [
                        factory.createPropertyAssignment(
                          factory.createIdentifier("scriptName"),
                          factory.createStringLiteral(args.webviewerScriptName)
                        ),
                      ]
                    : []),
                ],
                true
              ),
              ...(args.useZod
                ? [
                    factory.createObjectLiteralExpression(
                      [
                        factory.createPropertyAssignment(
                          factory.createIdentifier("fieldData"),
                          factory.createIdentifier(
                            `Z${varname(args.schemaName)}`
                          )
                        ),
                        // only add portal type if a portal type was passed
                        ...(args.portalTypeName
                          ? [
                              factory.createPropertyAssignment(
                                factory.createIdentifier("portalData"),
                                factory.createIdentifier(
                                  `Z${varname(args.schemaName)}Portals`
                                )
                              ),
                            ]
                          : []),
                      ],
                      true
                    ),
                  ]
                : []),
            ]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  ),
];

const stringProperty = (name: string) =>
  factory.createPropertySignature(
    undefined,
    factory.createStringLiteral(name),
    undefined,
    factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
  );
const stringPropertyZod = (name: string) =>
  factory.createPropertyAssignment(
    factory.createStringLiteral(name),
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("z"),
        factory.createIdentifier("string")
      ),
      undefined,
      []
    )
  );
const stringOrNumberProperty = (name: string) =>
  factory.createPropertySignature(
    undefined,
    factory.createStringLiteral(name),
    undefined,
    factory.createUnionTypeNode([
      factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ])
  );
const stringOrNumberPropertyZod = (name: string) =>
  factory.createPropertyAssignment(
    factory.createStringLiteral(name),
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("z"),
        factory.createIdentifier("union")
      ),
      undefined,
      [
        factory.createArrayLiteralExpression(
          [
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("z"),
                factory.createIdentifier("string")
              ),
              undefined,
              []
            ),
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("z"),
                factory.createIdentifier("number")
              ),
              undefined,
              []
            ),
          ],
          false
        ),
      ]
    )
  );
const NumberOrNullProperty = (name: string) =>
  factory.createPropertySignature(
    undefined,
    factory.createStringLiteral(name),
    undefined,
    factory.createUnionTypeNode([
      factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      factory.createLiteralTypeNode(factory.createNull()),
    ])
  );
const NumberOrNullPropertyZod = (name: string) =>
  factory.createPropertyAssignment(
    factory.createStringLiteral(name),
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("z"),
                  factory.createIdentifier("coerce")
                ),
                factory.createIdentifier("number")
              ),
              undefined,
              []
            ),
            factory.createIdentifier("nullable")
          ),
          undefined,
          []
        ),
        factory.createIdentifier("catch")
      ),
      undefined,
      [factory.createNull()]
    )
  );

const valueListProperty = (name: string, vl: string[]) =>
  factory.createPropertySignature(
    undefined,
    factory.createStringLiteral(name),
    undefined,
    factory.createUnionTypeNode(
      vl.map((v) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(v))
      )
    )
  );
const valueListPropertyZod = (name: string, vl: string[]) =>
  factory.createPropertyAssignment(
    factory.createStringLiteral(name),
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("z"),
        factory.createIdentifier("enum")
      ),
      undefined,
      [
        factory.createArrayLiteralExpression(
          vl.map((v) => factory.createStringLiteral(v)),
          false
        ),
      ]
    )
  );

const buildTypeZod = (
  schemaName: string,
  schema: Array<TSchema>,
  strictNumbers = false
): Statement[] => [
  factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(`Z${varname(schemaName)}`),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("z"),
              factory.createIdentifier("object")
            ),
            undefined,
            [
              factory.createObjectLiteralExpression(
                // for each field, create a z property
                schema.map((item) =>
                  item.type === "fmnumber"
                    ? strictNumbers
                      ? NumberOrNullPropertyZod(item.name)
                      : stringOrNumberPropertyZod(item.name)
                    : item.values
                    ? valueListPropertyZod(item.name, item.values)
                    : stringPropertyZod(item.name)
                ),
                true
              ),
            ]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  ),
  factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`T${varname(schemaName)}`),
    undefined,
    factory.createTypeReferenceNode(
      factory.createQualifiedName(
        factory.createIdentifier("z"),
        factory.createIdentifier("infer")
      ),
      [
        factory.createTypeQueryNode(
          factory.createIdentifier(`Z${varname(schemaName)}`)
        ),
      ]
    )
  ),
];
const buildValueListZod = (name: string, values: string[]): Statement[] => [
  factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(`ZVL${varname(name)}`),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("z"),
              factory.createIdentifier("enum")
            ),
            undefined,
            [
              factory.createArrayLiteralExpression(
                values.map((v) => factory.createStringLiteral(v)),
                false
              ),
            ]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  ),
  factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`TVL${varname(name)}`),
    undefined,
    factory.createTypeReferenceNode(
      factory.createQualifiedName(
        factory.createIdentifier("z"),
        factory.createIdentifier("infer")
      ),
      [
        factory.createTypeQueryNode(
          factory.createIdentifier(`ZVL${varname(name)}`)
        ),
      ]
    )
  ),
];
const buildValueListTS = (name: string, values: string[]): Statement =>
  factory.createTypeAliasDeclaration(
    undefined,
    factory.createIdentifier(`TVL${varname(name)}`),
    undefined,
    factory.createUnionTypeNode(
      values.map((v) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(v))
      )
    )
  );

const buildTypeTS = (
  schemaName: string,
  schema: Array<TSchema>,
  strictNumbers = false
): Statement =>
  factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`T${varname(schemaName)}`),
    undefined,
    factory.createTypeLiteralNode(
      // for each field, create a property
      schema.map((item) => {
        return item.type === "fmnumber"
          ? strictNumbers
            ? NumberOrNullProperty(item.name)
            : stringOrNumberProperty(item.name)
          : item.values
          ? valueListProperty(item.name, item.values)
          : stringProperty(item.name);
      })
    )
  );

type BuildSchemaArgs = {
  schemaName: string;
  schema: Array<TSchema>;
  type: "zod" | "ts";
  portalSchema?: { schemaName: string; schema: Array<TSchema> }[];
  valueLists?: { name: string; values: string[] }[];
  envNames: Omit<ClientObjectProps, "layout" | "tokenStore">;
  layoutName: string;
  strictNumbers?: boolean;
  configLocation?: string;
  webviewerScriptName?: string;
} & Pick<GenerateSchemaOptions, "tokenStore">;
const buildClientFile = (args: BuildSchemaArgs) => {
  const printer = createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const file = buildClient(args);
  return commentHeader + printer.printFile(file);
};
export const buildSchema = ({ type, ...args }: BuildSchemaArgs) => {
  // make sure schema has unique keys, in case a field is on the layout mulitple times
  args.schema.reduce(
    (acc: TSchema[], el) =>
      acc.find((o) => o.name === el.name)
        ? acc
        : ([...acc, el] as Array<TSchema>),
    []
  );
  // TODO same uniqueness validation for portals
  const printer = createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const file = type === "ts" ? buildTSSchema(args) : buildZodSchema(args);
  return commentHeader + printer.printFile(file);
};
const buildClient = (args: BuildSchemaArgs) => {
  const { schemaName, portalSchema = [], envNames, type } = args;
  return factory.updateSourceFile(
    createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
    [
      importTypeStatement(schemaName, portalSchema.length > 0, type === "zod"),
      // ...reimportConfigStatements(args.configLocation),
      ...exportClientStatement({
        envNames,
        useZod: type === "zod",
        schemaName: args.schemaName,
        layout: args.layoutName,
        tokenStore: getTokenStoreFromConfig(args.configLocation),
        fieldTypeName: `T${varname(schemaName)}`,
        ...(portalSchema.length > 0
          ? { portalTypeName: `T${varname(schemaName)}Portals` }
          : {}),
        webviewerScriptName: args.webviewerScriptName,
      }),
    ]
  );
};
const buildZodSchema = (args: Omit<BuildSchemaArgs, "type">) => {
  const {
    schema,
    schemaName,
    portalSchema = [],
    valueLists = [],
    strictNumbers = false,
  } = args;
  const portals = portalSchema
    .map((p) => buildTypeZod(p.schemaName, p.schema, strictNumbers))
    .flat();
  const vls = valueLists
    .filter((vl) => vl.values.length > 0)
    .map((vl) => buildValueListZod(vl.name, vl.values))
    .flat();

  const portalStatements = [
    factory.createVariableStatement(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(`Z${varname(schemaName)}Portals`),
            undefined,
            undefined,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("z"),
                factory.createIdentifier("object")
              ),
              undefined,
              [
                factory.createObjectLiteralExpression(
                  portalSchema.map((portal) =>
                    factory.createPropertyAssignment(
                      factory.createStringLiteral(portal.schemaName),
                      factory.createIdentifier(`Z${varname(portal.schemaName)}`)
                    )
                  ),
                  true
                ),
              ]
            )
          ),
        ],
        ts.NodeFlags.Const
      )
    ),
    factory.createTypeAliasDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(`T${varname(schemaName)}Portals`),
      undefined,
      factory.createTypeReferenceNode(
        factory.createQualifiedName(
          factory.createIdentifier("z"),
          factory.createIdentifier("infer")
        ),
        [
          factory.createTypeQueryNode(
            factory.createIdentifier(`Z${varname(schemaName)}Portals`)
          ),
        ]
      )
    ),
  ];

  return factory.updateSourceFile(
    createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
    [
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              false,
              undefined,
              factory.createIdentifier("z")
            ),
          ])
        ),
        factory.createStringLiteral("zod")
      ),
      // for each table, create a ZodSchema variable and inferred type
      ...buildTypeZod(schemaName, schema, strictNumbers),

      // now the same for each portal
      ...portals,

      // if there are portals, export single portal type for the layout
      ...(portalSchema.length > 0 ? portalStatements : []),

      // now add types for any values lists
      ...vls,
    ]
  );
};

const buildTSSchema = (args: Omit<BuildSchemaArgs, "type">) => {
  const {
    schema,
    schemaName,
    portalSchema = [],
    valueLists = [],
    strictNumbers = false,
  } = args;
  const portals = portalSchema.map((p) =>
    buildTypeTS(p.schemaName, p.schema, strictNumbers)
  );
  const vls = valueLists
    .filter((vl) => vl.values.length > 0)
    .map((vl) => buildValueListTS(vl.name, vl.values));
  const portalStatement = factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`T${varname(schemaName)}Portals`),
    undefined,
    factory.createTypeLiteralNode(
      portalSchema.map((portal) =>
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier(portal.schemaName),
          undefined,
          factory.createArrayTypeNode(
            factory.createTypeReferenceNode(
              factory.createIdentifier(`T${varname(portal.schemaName)}`),
              undefined
            )
          )
        )
      )
    )
  );

  return factory.updateSourceFile(
    createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
    [
      buildTypeTS(schemaName, schema, strictNumbers),
      ...portals,
      // if there are portals, export single portal type for the layout
      ...(portalSchema.length > 0 ? [portalStatement] : []),
      ...vls,
    ]
  );
};

export const getSchema = async (args: {
  client: ReturnType<typeof DataApi>;
  layout: string;
  valueLists?: ValueListsOptions;
}) => {
  const schemaReducer: F.Function<[FieldMetaData[]], TSchema[]> = (schema) =>
    schema.reduce((acc, field) => {
      if (acc.find((o) => o.name === field.name)) return acc; // skip duplicates
      if (
        meta &&
        field.valueList &&
        meta.valueLists &&
        valueLists !== "ignore"
      ) {
        const list = meta.valueLists.find((o) => o.name === field.valueList);
        const values = list?.values.map((o) => o.value) ?? [];
        return [
          ...acc,
          {
            name: field.name,
            type: "valueList",
            values: valueLists === "allowEmpty" ? [...values, ""] : values,
          },
        ];
      }
      return [
        ...acc,
        {
          name: field.name,
          type: field.result === "number" ? "fmnumber" : "string",
        },
      ];
    }, [] as TSchema[]);

  const { client, layout, valueLists = "ignore" } = args;
  const meta = await client.metadata({ layout }).catch((err) => {
    if (err instanceof FileMakerError && err.code === "105") {
      console.log(
        chalk.bold.red("ERROR:"),
        "Skipping schema generation for layout:",
        chalk.bold.underline(layout),
        "(not found)"
      );
      return;
    }
    throw err;
  });
  if (!meta) return;
  const schema = schemaReducer(meta.fieldMetaData);
  const portalSchema = Object.keys(meta.portalMetaData).map((schemaName) => {
    const schema = schemaReducer(meta.portalMetaData[schemaName]);
    return { schemaName, schema };
  });
  const valueListValues =
    meta.valueLists?.map((vl) => ({
      name: vl.name,
      values: vl.values.map((o) => o.value),
    })) ?? [];
  // remove duplicates from valueListValues
  const valueListValuesUnique = valueListValues.reduce((acc, vl) => {
    if (acc.find((o) => o.name === vl.name)) return acc;
    return [...acc, vl];
  }, [] as typeof valueListValues);

  return { schema, portalSchema, valueLists: valueListValuesUnique };
};

function reimportConfigStatements(configLocation?: string) {
  if (!configLocation) return [];

  const sourceFileText = fs.readFileSync(configLocation, "utf-8");
  const sourceFile = ts.createSourceFile(
    "x.ts",
    sourceFileText,
    ts.ScriptTarget.Latest
  );

  const imports: ts.ImportDeclaration[] = [];

  sourceFile.forEachChild((child) => {
    if (!ts.isImportDeclaration(child)) return;
    const shouldIgnore = ts
      .getLeadingCommentRanges(sourceFileText, child.getFullStart())
      ?.map((range) =>
        sourceFileText.slice(range.pos, range.end).replace(" ", "")
      )
      .some((o) => o.search("codgen-ignore"));

    if (shouldIgnore) return;

    imports.push(child);
  });
  return imports;
}

function getTokenStoreFromConfig(
  configLocation?: string
): ts.Expression | undefined {
  if (!configLocation) return undefined;

  const sourceFileText = fs.readFileSync(configLocation, "utf-8");
  const sourceFile = ts.createSourceFile(
    "x.ts",
    sourceFileText,
    ts.ScriptTarget.Latest
  );

  let result: ts.Expression | undefined = undefined;

  sourceFile.forEachChild((child) => {
    if (!ts.isVariableStatement(child)) return;
    const testID = child.declarationList.declarations[0].name;
    if (!ts.isIdentifier(testID) || testID.escapedText !== "config") return;

    const init = child.declarationList.declarations[0].initializer;

    if (init && ts.isObjectLiteralExpression(init)) {
      const tokenStore = init.properties.find((o) => {
        if (o.name && ts.isIdentifier(o.name)) {
          return o.name.escapedText === "tokenStore";
        }
        return false;
      });
      if (!tokenStore) return;
      if (ts.isPropertyAssignment(tokenStore)) {
        if (ts.isIdentifier(tokenStore.initializer)) {
          result = factory.createCallExpression(
            tokenStore.initializer,
            undefined,
            []
          );
        } else if (
          ts.isArrowFunction(tokenStore.initializer) &&
          ts.isCallExpression(tokenStore.initializer.body)
        ) {
          result = tokenStore.initializer.body;
        } else {
          result = tokenStore.initializer;
        }
      }
    }
    return child.declarationList.declarations[0].initializer;
  });

  return result;
}

export type ValueListsOptions = "strict" | "allowEmpty" | "ignore";
export type GenerateSchemaOptions = {
  envNames?: Partial<Omit<ClientObjectProps, "layout">>;
  schemas: Array<{
    layout: string;
    schemaName: string;
    valueLists?: ValueListsOptions;
    /**
     * If `true`, the generated files will include a layout-specific client. Set this to `false` if you only want to use the types. Overrides the top-level generateClient option for this specific schema.
     * @default true
     */
    generateClient?: boolean;
    /** If `true`, number fields will be typed as `number | null` instead of `number | string`. If the data cannot be parsed as a number, it will be set to `null`.
     * @default false
     */
    strictNumbers?: boolean;
  }>;
  /**
   * If `true`, the generated files will include a layout-specific client. Set this to `false` if you only want to use the types
   * @default true
   */
  generateClient?: boolean;
  path?: string;
  useZod?: boolean;
  tokenStore?: () => TokenStoreDefinitions;
  /**
   * If set, the generated files will include the webviewer client instead of the standard REST API client.
   * This script should pass the parameter to the Execute Data API Script step and return the result to the webviewer per the "@proofgeist/fm-webviewer-fetch" documentation.
   * Requires "@proofgeist/fm-webviewer-fetch" installed as a peer dependency.
   * The REST API client (and related credentials) is still needed to generate the types.
   *
   * @link https://fm-webviewer-fetch.proofgeist.com/
   */
  webviewerScriptName?: string;
};
export const generateSchemas = async (
  options: GenerateSchemaOptions,
  configLocation?: string
) => {
  const {
    envNames,
    schemas,
    path = "schema",
    useZod = true,
    generateClient = true,
    webviewerScriptName,
  } = options;

  const defaultEnvNames = {
    apiKey: "OTTO_API_KEY",
    ottoPort: "OTTO_PORT",
    username: "FM_USERNAME",
    password: "FM_PASSWORD",
    server: "FM_SERVER",
    db: "FM_DATABASE",
  };

  if (webviewerScriptName !== undefined && !!options.tokenStore)
    console.log(
      `${chalk.yellow(
        "NOTE:"
      )} The webviewer client does not store any tokens. The tokenStore option will be ignored.`
    );

  // if (configLocation) {
  //   getTokenStoreFromConfig(configLocation);
  //   return;
  // }

  const server = process.env[envNames?.server ?? defaultEnvNames.server];
  const db = process.env[envNames?.db ?? defaultEnvNames.db];
  const apiKey =
    (envNames?.auth && isOttoAuth(envNames.auth)
      ? process.env[envNames.auth.apiKey ?? defaultEnvNames.apiKey]
      : undefined) ?? process.env[defaultEnvNames.apiKey];
  const ottoPort =
    (envNames?.auth && isOttoAuth(envNames.auth)
      ? process.env[envNames.auth.ottoPort ?? defaultEnvNames.ottoPort]
      : undefined) ?? "3030";
  const username =
    (envNames?.auth && !isOttoAuth(envNames.auth)
      ? process.env[envNames.auth.username ?? defaultEnvNames.username]
      : undefined) ?? process.env[defaultEnvNames.username];
  const password =
    (envNames?.auth && !isOttoAuth(envNames.auth)
      ? process.env[envNames.auth.password ?? defaultEnvNames.password]
      : undefined) ?? process.env[defaultEnvNames.password];

  const auth: ClientObjectProps["auth"] = apiKey
    ? { apiKey: apiKey as any }
    : { username: username ?? "", password: password ?? "" };

  if (!server || !db || (!apiKey && !username)) {
    console.log(chalk.red("ERROR: Could not get all required config values"));
    console.log("Ensure the following environment variables are set:");
    if (!server) console.log(`${envNames?.server ?? defaultEnvNames.server}`);
    if (!db) console.log(`${envNames?.db ?? defaultEnvNames.db}`);
    if (!apiKey)
      console.log(
        `${
          (envNames?.auth &&
            isOttoAuth(envNames.auth) &&
            envNames.auth.apiKey) ??
          defaultEnvNames.apiKey
        } (or ${
          (envNames?.auth &&
            !isOttoAuth(envNames.auth) &&
            envNames.auth.username) ??
          defaultEnvNames.username
        } and ${
          (envNames?.auth &&
            !isOttoAuth(envNames.auth) &&
            envNames.auth.password) ??
          defaultEnvNames.password
        })`
      );

    console.log();
    return;
  }

  const client = DataApi({ auth, server, db, tokenStore: memoryStore() });
  await fs.ensureDir(path);
  const clientExportsMap: { [key: string]: ts.ExportDeclaration } = {};

  for await (const item of schemas) {
    const result = await getSchema({
      client,
      layout: item.layout,
      valueLists: item.valueLists,
    });
    if (!result) continue;

    const { schema, portalSchema, valueLists } = result;
    const args: BuildSchemaArgs = {
      schemaName: item.schemaName,
      schema,
      layoutName: item.layout,
      portalSchema,
      valueLists,
      type: useZod ? "zod" : "ts",
      strictNumbers: item.strictNumbers,
      configLocation,
      webviewerScriptName: options.webviewerScriptName,
      envNames: {
        auth: isOttoAuth(auth)
          ? {
              apiKey:
                envNames?.auth && "apiKey" in envNames.auth
                  ? envNames.auth.apiKey
                  : (defaultEnvNames.apiKey as any),
            }
          : {
              username:
                envNames?.auth && "username" in envNames.auth
                  ? envNames.auth.username
                  : defaultEnvNames.username,
              password:
                envNames?.auth && "password" in envNames.auth
                  ? envNames.auth.password
                  : defaultEnvNames.password,
            },
        db: envNames?.db ?? defaultEnvNames.db,
        server: envNames?.server ?? defaultEnvNames.server,
      },
    };
    const code = buildSchema(args);
    fs.writeFile(join(path, `${item.schemaName}.ts`), code);

    if (item.generateClient ?? generateClient) {
      await ensureDir(join(path, "client"));
      const clientCode = buildClientFile(args);
      const clientExport = exportIndexClientStatement(item.schemaName);
      clientExportsMap[item.schemaName] = clientExport;
      fs.writeFile(join(path, "client", `${item.schemaName}.ts`), clientCode);
    }
  }

  if (Object.keys(clientExportsMap).length !== 0) {
    // add an index file with all clients exported, sorted by name
    const exportNames = Object.keys(clientExportsMap).sort();
    const clientExports: ts.ExportDeclaration[] = [];
    for (let i = 0; i < exportNames.length; i++) {
      clientExports.push(clientExportsMap[exportNames[i]]);
    }

    const printer = createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const file = factory.updateSourceFile(
      createSourceFile(`source.ts`, "", ts.ScriptTarget.Latest),
      clientExports
    );
    const indexCode = printer.printFile(file);
    fs.writeFile(join(path, "client", `index.ts`), indexCode);
  }
};
