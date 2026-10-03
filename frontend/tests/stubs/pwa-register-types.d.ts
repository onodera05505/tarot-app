// アプリの入口（src/main.tsx）を読み込むテストの型検査用。`virtual:pwa-register` の型は
// 保持の仕組みのプラグインが配る宣言にあり、tsconfig.test.json の types には入っていないので、ここで引く。
/// <reference types="vite-plugin-pwa/client" />
