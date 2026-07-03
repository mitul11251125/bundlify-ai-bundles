/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

declare module "*?dataurl" {
  const content: string;
  export default content;
}
