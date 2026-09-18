/**
 * twikoo-aws-lambda 入口（handler 为 Lambda 具名导出）。
 */
export { handler, createLambdaFunc, toTkRequest, fromTkResponse } from "./main";
export { lambdaPostSubmitDispatcher } from "./dispatch";
