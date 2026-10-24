// bcryptjs is Keystone's own password hasher (a dependency of @keystone-6/core) and ships no types.
declare module "bcryptjs" {
  const bcryptjs: { compare(value: string, hash: string): Promise<boolean> };
  export default bcryptjs;
}
