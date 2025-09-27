//import initSqlJs, { Database } from "sql.js";
import initSqlJs, { type Database } from 'sql.js'

let dbPromise: Promise<Database> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {

      // Fetch wasm manually
      const wasmBinary = await fetch(chrome.runtime.getURL("sql-wasm.wasm"))
        .then(res => res.arrayBuffer());

   // Init sql.js with pre-fetched binary
      const SQL = await initSqlJs({
        locateFile: (file: string) => chrome.runtime.getURL(file),
        wasmBinary, // bypass CSP
      } as any);
      /*const SQL = await initSqlJs({
        // load wasm from the extension bundle (CSP-safe)
        locateFile: (file) => chrome.runtime.getURL(file),
      });*/

      const db = new SQL.Database();

      // make sure both tables exist
      db.run(`
        CREATE TABLE IF NOT EXISTS dids (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          did TEXT,
          pk TEXT,
          sk TEXT
        );
        CREATE TABLE IF NOT EXISTS credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          issuer TEXT,
          subject TEXT,
          format TEXT,
          vc TEXT
        );
      `);

      console.log("[Wallet DB] Initialized successfully");
      return db;
    })();
  }
  return dbPromise;
}

// Optional helper if you need to persist DB bytes
export async function persistDB() {
  const db = await getDB();
  const data = db.export();
  console.log("[Wallet DB] Persisted, size:", data.length);
  return data;
}


/*import initSqlJs, { type Database } from 'sql.js'

const DB_KEY = 'WALLET_SQLITE'

let dbPromise: Promise<Database> | null = null
//let dbPromise: Promise<any> | null = null

export async function getDB()//: Promise<Database> 
{
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => `./${file}`,
    })
    const stored = await chrome.storage.local.get(DB_KEY)
    const bytes: Uint8Array | undefined = stored?.[DB_KEY]
    const db = bytes ? new SQL.Database(bytes) : new SQL.Database()
    db.run(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        data TEXT
      )
    `)
    return db
  })()
  return dbPromise
}

export async function persistDB(db: Database) {
  const data = db.export()
  await chrome.storage.local.set({ [DB_KEY]: data })
}*/


