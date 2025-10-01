import { createAgent } from '@veramo/core';
import { DIDManager } from '@veramo/did-manager';
import { KeyManager } from '@veramo/key-manager';
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { KeyDIDProvider, getDidKeyResolver } from '@veramo/did-provider-key';
import { Resolver } from 'did-resolver';
import { Entities, KeyStore, DIDStore, PrivateKeyStore, migrations } from '@veramo/data-store';
import { DataSource } from 'typeorm';
import { DataStore, DataStoreORM } from '@veramo/data-store';
// Database configuration
const dbConnection = new DataSource({
    type: 'better-sqlite3',
    database: './database/wallet.sqlite',
    synchronize: false,
    migrationsRun: true,
    migrations,
    entities: Entities,
}).initialize();
// Secret key for encryption (in production, use secure key management)
const SECRET_KEY = process.env.SECRET_KEY || '29739248cad1bd1a0fc4d9b75cd4d2990de535baf5caadfdf8d8f86664aa830c';
// Create Veramo agent
export const agent = createAgent({
    plugins: [
        new KeyManager({
            store: new KeyStore(dbConnection),
            kms: {
                local: new KeyManagementSystem(new PrivateKeyStore(dbConnection, new SecretBox(SECRET_KEY))),
            },
        }),
        new DIDManager({
            store: new DIDStore(dbConnection),
            defaultProvider: 'did:key',
            providers: {
                'did:key': new KeyDIDProvider({
                    defaultKms: 'local',
                }),
            },
        }),
        new DIDResolverPlugin({
            resolver: new Resolver({
                ...getDidKeyResolver(),
            }),
        }),
        new CredentialPlugin(),
        new DataStore(dbConnection),
        new DataStoreORM(dbConnection),
    ],
});
// Helper function to ensure wallet has a DID
export const ensureWalletDID = async () => {
    const identifiers = await agent.didManagerFind();
    if (identifiers.length === 0) {
        console.log('🆔 Creating new wallet DID...');
        const identifier = await agent.didManagerCreate({ alias: 'wallet-main' });
        console.log(`✅ Wallet DID created: ${identifier.did}`);
        return identifier.did;
    }
    const walletDID = identifiers[0].did;
    console.log(`🆔 Using existing wallet DID: ${walletDID}`);
    return walletDID;
};
//# sourceMappingURL=agent.js.map