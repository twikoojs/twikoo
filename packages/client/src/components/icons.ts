/**
 * 图标注册表（T29 用户修正：从 @fortawesome/fontawesome-free/svgs/ 按需引入
 * SVG 文件，替代 webfont——字体含全量图标会显著膨胀最终产物）。
 *
 * 规则：**只 import 本表用到的图标文件**（Vite ?raw 原样内联），未引入的图标
 * 不进产物；新增图标 = 加一行 import + 一行注册。
 */
import paperPlane from "@fortawesome/fontawesome-free/svgs/solid/paper-plane.svg?raw";
import heart from "@fortawesome/fontawesome-free/svgs/solid/heart.svg?raw";
import reply from "@fortawesome/fontawesome-free/svgs/solid/reply.svg?raw";
import image from "@fortawesome/fontawesome-free/svgs/solid/image.svg?raw";
import faceSmile from "@fortawesome/fontawesome-free/svgs/solid/face-smile.svg?raw";
import circleCheck from "@fortawesome/fontawesome-free/svgs/solid/circle-check.svg?raw";
import circleExclamation from "@fortawesome/fontawesome-free/svgs/solid/circle-exclamation.svg?raw";
import spinner from "@fortawesome/fontawesome-free/svgs/solid/spinner.svg?raw";

/** 图标名 → SVG 内容（用户提供的原始 SVG 字符串） */
export const ICONS: Record<string, string> = {
  "paper-plane": paperPlane,
  heart,
  reply,
  image,
  "face-smile": faceSmile,
  "circle-check": circleCheck,
  "circle-exclamation": circleExclamation,
  spinner,
};
