/** 通过本地 SMTP 会话验证真实 nodemailer 的发送、认证失败和连接生命周期。 */
import { once } from "node:events";
import { createServer } from "node:net";
import type { AddressInfo, Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createCloudflareNodemailer } from "../../src/mail/nodemailer";
import { fetchCalls, useFakeFetch } from "../utils/fake-fetch";

/** 用例结束时关闭监听器和未完成的连接，避免失败路径泄漏资源。 */
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

/** 提供最小 SMTP 对端；生产客户端始终是真实 nodemailer，而不是传输器替身。 */
async function smtpServer() {
  const sockets = new Set<Socket>();
  const closed: Array<Promise<unknown>> = [];
  const messages: string[] = [];
  const server = createServer((socket) => {
    sockets.add(socket);
    closed.push(once(socket, "close"));
    socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    socket.write("220 localhost ESMTP\r\n");
    let buffer = "";
    let data: string[] | undefined;
    socket.on("data", (chunk) => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") {
            messages.push(data.join("\r\n"));
            data = undefined;
            socket.write("250 queued\r\n");
          } else {
            data.push(line);
          }
        } else if (line.startsWith("EHLO")) {
          socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        } else if (line.startsWith("AUTH PLAIN ")) {
          const credentials = Buffer.from(line.slice(11), "base64").toString();
          socket.write(
            credentials === "\0user\0token" ? "235 authenticated\r\n" : "535 bad credentials\r\n",
          );
        } else if (line.startsWith("RCPT TO:<missing@")) {
          socket.write("550 unknown recipient\r\n");
        } else if (line === "DATA") {
          data = [];
          socket.write("354 send message\r\n");
        } else if (line === "QUIT") {
          socket.end("221 goodbye\r\n");
        } else {
          socket.write("250 OK\r\n");
        }
      }
    });
  });
  cleanups.push(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    config: {
      host: "127.0.0.1",
      port: (server.address() as AddressInfo).port,
      secure: false,
      ignoreTLS: true,
      auth: { user: "user", pass: "token" },
      connectionTimeout: 1000,
      socketTimeout: 1000,
    },
    messages,
    closed,
    sockets,
  };
}

/** SMTP 邮件载荷使用纯文本，便于检查实际接收到的 MIME 正文。 */
const mail = {
  from: "blog@example.com",
  to: "guest@example.com",
  subject: "SMTP notification",
  text: "Delivered through SMTP",
};

describe("真实 SMTP 通道", () => {
  it("主机配置通过 SMTP 校验并发送；即使请求池化也不保留跨调用连接", async () => {
    useFakeFetch(() => ({ status: 200 }));
    const smtp = await smtpServer();
    const transport = createCloudflareNodemailer().createTransport({ ...smtp.config, pool: true });
    await expect(transport.verify?.()).resolves.toBe(true);
    await expect(transport.sendMail(mail)).resolves.toMatchObject({ accepted: [mail.to] });
    await expect(transport.sendMail({ ...mail, text: "Second request" })).resolves.toMatchObject({
      accepted: [mail.to],
    });
    await Promise.all(smtp.closed);
    expect(smtp.messages[0]).toContain("Subject: SMTP notification");
    expect(smtp.messages[0]).toContain("Delivered through SMTP");
    expect(smtp.messages[1]).toContain("Second request");
    expect(smtp.closed).toHaveLength(3);
    expect(smtp.sockets.size).toBe(0);
    expect(fetchCalls()).toEqual([]);
  });

  it("非 HTTP 服务保留 SMTP 路径，并原样传播校验和发送的认证失败", async () => {
    useFakeFetch(() => ({ status: 200 }));
    const smtp = await smtpServer();
    const transport = createCloudflareNodemailer().createTransport({
      ...smtp.config,
      service: "custom-smtp-provider",
      auth: { user: "user", pass: "wrong" },
    });
    await expect(transport.verify?.()).rejects.toMatchObject({ code: "EAUTH", responseCode: 535 });
    await expect(transport.sendMail(mail)).rejects.toMatchObject({
      code: "EAUTH",
      responseCode: 535,
    });
    await Promise.all(smtp.closed);
    expect(smtp.messages).toEqual([]);
    expect(smtp.sockets.size).toBe(0);
    expect(fetchCalls()).toEqual([]);
  });

  it("发送时保留 SMTP 收件人拒绝错误，不回退到 HTTP 或报告成功", async () => {
    useFakeFetch(() => ({ status: 200 }));
    const smtp = await smtpServer();
    const transport = createCloudflareNodemailer().createTransport(smtp.config);
    await expect(transport.sendMail({ ...mail, to: "missing@example.com" })).rejects.toMatchObject({
      code: "EENVELOPE",
      responseCode: 550,
      command: "RCPT TO",
    });
    await Promise.all(smtp.closed);
    expect(smtp.messages).toEqual([]);
    expect(smtp.sockets.size).toBe(0);
    expect(fetchCalls()).toEqual([]);
  });
});
