/**
 * 图标注册表（T29 用户修正：从 `@fortawesome/fontawesome-free/svgs/` 按需引入
 * SVG 文件，替代 webfont——字体含全量图标会显著膨胀最终产物）。
 *
 * 规则：
 * - **只 import 本表用到的图标文件**（Vite `?raw` 原样内联），未引入的图标不进产物；
 *   新增图标 = 加一行 import + 一行注册；
 * - 命名约定：solid 图标用短名（如 `comment`），regular（线性）图标加 `-regular`
 *   后缀（如 `comment-regular`）——与 1.x `TkAction.vue` 的「实心/线性双图标切换」
 *   用法对应（1.x 的 `iconLike` = regular、`iconLikeSolid` = solid）；
 * - 图标文件与 1.x 完全同源（1.x 直接 `import ... from '@fortawesome/.../x.svg'`），
 *   因此视觉表现与 1.x 一致。
 */
import circleCheck from "@fortawesome/fontawesome-free/svgs/solid/circle-check.svg?raw";
import circleExclamation from "@fortawesome/fontawesome-free/svgs/solid/circle-exclamation.svg?raw";
import circleXmark from "@fortawesome/fontawesome-free/svgs/solid/circle-xmark.svg?raw";
import cog from "@fortawesome/fontawesome-free/svgs/solid/cog.svg?raw";
import comment from "@fortawesome/fontawesome-free/svgs/solid/comment.svg?raw";
import eye from "@fortawesome/fontawesome-free/svgs/solid/eye.svg?raw";
import eyeSlash from "@fortawesome/fontawesome-free/svgs/solid/eye-slash.svg?raw";
import faceSmile from "@fortawesome/fontawesome-free/svgs/solid/face-smile.svg?raw";
import heart from "@fortawesome/fontawesome-free/svgs/solid/heart.svg?raw";
import image from "@fortawesome/fontawesome-free/svgs/solid/image.svg?raw";
import laugh from "@fortawesome/fontawesome-free/svgs/solid/laugh.svg?raw";
import locationArrow from "@fortawesome/fontawesome-free/svgs/solid/location-arrow.svg?raw";
import magnifyingGlass from "@fortawesome/fontawesome-free/svgs/solid/magnifying-glass.svg?raw";
import paperPlane from "@fortawesome/fontawesome-free/svgs/solid/paper-plane.svg?raw";
import reply from "@fortawesome/fontawesome-free/svgs/solid/reply.svg?raw";
import spinner from "@fortawesome/fontawesome-free/svgs/solid/spinner.svg?raw";
import sync from "@fortawesome/fontawesome-free/svgs/solid/sync.svg?raw";
import thumbsDown from "@fortawesome/fontawesome-free/svgs/solid/thumbs-down.svg?raw";
import thumbsUp from "@fortawesome/fontawesome-free/svgs/solid/thumbs-up.svg?raw";
import times from "@fortawesome/fontawesome-free/svgs/solid/times.svg?raw";
import trashAlt from "@fortawesome/fontawesome-free/svgs/solid/trash-alt.svg?raw";
import userCircle from "@fortawesome/fontawesome-free/svgs/solid/user-circle.svg?raw";
import windowMaximize from "@fortawesome/fontawesome-free/svgs/solid/window-maximize.svg?raw";

import commentRegular from "@fortawesome/fontawesome-free/svgs/regular/comment.svg?raw";
import imageRegular from "@fortawesome/fontawesome-free/svgs/regular/image.svg?raw";
import laughRegular from "@fortawesome/fontawesome-free/svgs/regular/laugh.svg?raw";
import thumbsDownRegular from "@fortawesome/fontawesome-free/svgs/regular/thumbs-down.svg?raw";
import thumbsUpRegular from "@fortawesome/fontawesome-free/svgs/regular/thumbs-up.svg?raw";
import trashAltRegular from "@fortawesome/fontawesome-free/svgs/regular/trash-alt.svg?raw";
import windowMaximizeRegular from "@fortawesome/fontawesome-free/svgs/regular/window-maximize.svg?raw";

import android from "@fortawesome/fontawesome-free/svgs/brands/android.svg?raw";
import apple from "@fortawesome/fontawesome-free/svgs/brands/apple.svg?raw";
import chrome from "@fortawesome/fontawesome-free/svgs/brands/chrome.svg?raw";
import edge from "@fortawesome/fontawesome-free/svgs/brands/edge.svg?raw";
import firefoxBrowser from "@fortawesome/fontawesome-free/svgs/brands/firefox-browser.svg?raw";
import internetExplorer from "@fortawesome/fontawesome-free/svgs/brands/internet-explorer.svg?raw";
import linux from "@fortawesome/fontawesome-free/svgs/brands/linux.svg?raw";
import markdown from "@fortawesome/fontawesome-free/svgs/brands/markdown.svg?raw";
import safari from "@fortawesome/fontawesome-free/svgs/brands/safari.svg?raw";
import ubuntu from "@fortawesome/fontawesome-free/svgs/brands/ubuntu.svg?raw";
import windows from "@fortawesome/fontawesome-free/svgs/brands/windows.svg?raw";

/** 图标名 → SVG 内容（fontawesome 官方文件的原始字符串） */
export const ICONS: Record<string, string> = {
  "circle-check": circleCheck,
  "circle-exclamation": circleExclamation,
  "circle-xmark": circleXmark,
  cog,
  comment,
  "comment-regular": commentRegular,
  eye,
  "eye-slash": eyeSlash,
  "face-smile": faceSmile,
  heart,
  image,
  "image-regular": imageRegular,
  laugh,
  "laugh-regular": laughRegular,
  "location-arrow": locationArrow,
  "magnifying-glass": magnifyingGlass,
  "paper-plane": paperPlane,
  reply,
  spinner,
  sync,
  "thumbs-down": thumbsDown,
  "thumbs-down-regular": thumbsDownRegular,
  "thumbs-up": thumbsUp,
  "thumbs-up-regular": thumbsUpRegular,
  times,
  trash: trashAlt,
  "trash-regular": trashAltRegular,
  "user-circle": userCircle,
  "window-maximize": windowMaximize,
  "window-maximize-regular": windowMaximizeRegular,
  android,
  apple,
  chrome,
  edge,
  "firefox-browser": firefoxBrowser,
  "internet-explorer": internetExplorer,
  linux,
  markdown,
  safari,
  ubuntu,
  windows,
};
