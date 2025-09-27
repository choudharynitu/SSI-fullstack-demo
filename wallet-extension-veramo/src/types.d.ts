/// <reference types="chrome" />

// Allow importing JSON if needed
declare module "*.json" {
  const value: any
  export default value
}
