/**
 * SEA 静态内联依赖的最小类型面（T47）。
 *
 * `bundled-libs.ts` 需要**静态 import** 下列包（SEA 单文件产物必须内联，原因见该文件头注释），
 * 但其中 jsdom / nodemailer / xml2js / html-to-text 不自带类型声明，
 * `@imaegoo/node-ip2region` 为无类型的 fork。
 *
 * 本文件只声明「模块可被导入」这一事实：模块本体作为**不透明命名空间**透传给
 * `setLibImporter`，成员的类型约束由 `@twikoojs/common` 的 `*Like` 接口
 * （`src/utils/lib-loader.ts`）承担——与 common 处理 lokijs 的做法一致
 * （`packages/server-common/src/types/lokijs.d.ts`）。
 *
 * 不引入 `@types/*` 的理由：① 这些包在本入口只被「搬运」，不存在任何成员访问；
 * ② 保持与 common 一致的 ambient 声明做法，避免为打包入口引入一批类型依赖。
 */

/** jsdom：项目只经 common 的 JSDOMLike 使用 `JSDOM` 构造器 */
declare module "jsdom";

/** nodemailer：项目只经 common 的 NodemailerLike 使用 `createTransport` */
declare module "nodemailer";

/** xml2js：项目只经 common 的 Xml2jsLike 使用 `parseStringPromise` */
declare module "xml2js";

/** html-to-text：项目只经 common 的 HtmlToTextLike 使用 `compile` */
declare module "html-to-text";

/** @imaegoo/node-ip2region：fork 无类型；项目只经 common 的 Ip2RegionLike 使用 `search` */
declare module "@imaegoo/node-ip2region";
