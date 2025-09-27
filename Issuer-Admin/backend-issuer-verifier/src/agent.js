import { createAgent } from '@veramo/core';
import { KeyManager } from '@veramo/key-manager';
import { DIDManager } from '@veramo/did-manager';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { Resolver } from 'did-resolver';
import { EthrDIDProvider } from '@veramo/did-provider-ethr';
import { getResolver as ethrDidResolver } from 'ethr-did-resolver';
import { CheqdDIDProvider } from '@cheqd/did-provider-cheqd';
import { getResolver as getCheqdResolver } from '@cheqd/did-provider-cheqd';
import { KeyDIDProvider } from '@veramo/did-provider-key';
import { getDidKeyResolver as keyDidResolver } from '@veramo/did-provider-key';
import { WebDIDProvider } from '@veramo/did-provider-web';
import { getResolver as webDidResolver } from 'web-did-resolver';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { CredentialIssuerLD, VeramoJsonWebSignature2020 } from '@veramo/credential-ld';
import { DataStore, DataStoreORM } from '@veramo/data-store';
import { KeyManagementSystem } from '@veramo/kms-local';
import { DataSource } from 'typeorm';
import { DIDStore, KeyStore, PrivateKeyStore, Entities, migrations } from '@veramo/data-store';
import { SecretBox } from '@veramo/kms-local';
// SQLite database connection
const dbConnection = new DataSource({
    type: 'sqlite',
    database: './database.sqlite',
    synchronize: true,
    migrations,
    migrationsRun: true,
    logging: true,
    entities: Entities,
    //entities: [DIDStore, KeyStore, PrivateKeyStore],
}).initialize();
const KMS_SECRET_KEY = 'd96833989ab7a9cacb662653f156ff9cfcce7bf29f04eb41b9d2d449ebf66f56';
export const agent = createAgent({
    plugins: [
        new KeyManager({
            store: new KeyStore(dbConnection),
            kms: {
                local: new KeyManagementSystem(new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))),
            },
        }),
        new DIDManager({
            store: new DIDStore(dbConnection),
            defaultProvider: 'did:key',
            providers: {
                'did:key': new KeyDIDProvider({ defaultKms: 'local' }),
                'did:web': new WebDIDProvider({ defaultKms: 'local' }),
                'did:ethr:sepolia': new EthrDIDProvider({
                    defaultKms: 'local',
                    network: 'sepolia',
                    rpcUrl: 'https://sepolia.infura.io/v3/8a9e7e0b9ef34bdf8670f8284bb5194d',
                }),
                'did:cheqd:testnet': new CheqdDIDProvider({
                    defaultKms: 'local',
                    cosmosPayerSeed: 'knife useless tray chase kit drama road chase autumn inform swim discover',
                    rpcUrl: 'https://rpc.cheqd.network',
                    dkgOptions: {
                        chain: 'cheqdTestnet',
                        network: 'datil-dev'
                    }
                }),
            },
        }),
        new CredentialIssuerLD({
            contextMaps: [],
            suites: [new VeramoJsonWebSignature2020()],
        }),
        new CredentialPlugin(),
        new DIDResolverPlugin({
            resolver: new Resolver({
                ...keyDidResolver(),
                ...webDidResolver(),
                ...ethrDidResolver({ infuraProjectId: '8a9e7e0b9ef34bdf8670f8284bb5194d' }),
                ...getCheqdResolver({
                    url: 'https://resolver.cheqd.net/1.0/identifiers/',
                }),
            }),
        }),
        new DataStore(dbConnection),
        new DataStoreORM(dbConnection),
    ],
});
export { dbConnection };
(async () => {
    const methods = await agent.availableMethods();
    console.log('🔎 Available Agent Methods:', methods);
})();
