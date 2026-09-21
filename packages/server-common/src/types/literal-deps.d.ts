/**
 * `lib-loader.ts` 的 `LITERAL_LOADERS` 所引用、但**不自带类型声明**的重依赖的最小类型面。
 *
 * `LITERAL_LOADERS` 必须写**字面量** specifier（否则静态追踪器解析不到包，见该表上方注释），
 * 而字面量会让 TS 去解析模块类型——其中 jsdom / xml2js / html-to-text 不带类型声明、
 * `@imaegoo/node-ip2region` 是无类型的 fork，于是需要这里补一份 ambient 声明。
 *
 * 本文件只声明「模块可被导入」这一事实：模块本体作为**不透明命名空间**透传给
 * `pickDefault`，成员的类型约束由 `lib-loader.ts` 的 `*Like` 接口承担——与 common 处理
 * lokijs 的做法一致（`./lokijs.d.ts`），也与 `twikoo-pkg` 的 `./bundled-deps.d.ts` 同构。
 *
 * 不引入 `@types/*` 的理由：① 这些包在本入口只被「搬运」，不存在任何成员访问；
 * ② 保持 ambient 声明做法一致，避免为核心库引入一批类型依赖。
 */

/** jsdom：项目只经 lib-loader 的 JSDOMLike 使用 `JSDOM` 构造器 */
declare module "jsdom";

/** xml2js：项目只经 lib-loader 的 Xml2jsLike 使用 `parseStringPromise` */
declare module "xml2js";

/** html-to-text：项目只经 lib-loader 的 HtmlToTextLike 使用 `compile` */
declare module "html-to-text";

/** @imaegoo/node-ip2region：fork 无类型；项目只经 lib-loader 的 Ip2RegionLike 使用 `search` */
declare module "@imaegoo/node-ip2region";
