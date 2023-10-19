import React from "react";
import { useLatestCallback } from "@shades/common/react";
import { useCachedState } from "@shades/common/app";
import { getPublicKeyAsync, utils as EdDSAUtils } from "@noble/ed25519";
import { bytesToHex, encodeAbiParameters, parseAbi } from "viem";
import { useSignerByPublicKey } from "../hooks/hub";
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { DEFAULT_CHAIN_ID } from "../hooks/farcord";
import useFarcasterAccount from "./farcaster-account";

const warpcastApi = "https://api.warpcast.com";

const DEFAULT_KEY_REGISTRY_ADDRESS =
  "0x00000000fC9e66f1c6d86D750B4af47fF0Cc343d";

const KEY_METADATA_TYPE = [
  {
    components: [
      {
        internalType: "uint256",
        name: "requestFid",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "requestSigner",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    internalType: "struct SignedKeyRequestValidator.SignedKeyRequestMetadata",
    name: "metadata",
    type: "tuple",
  },
];

export const createCacheKey = (address) =>
  [address?.toLowerCase(), "signer"].filter(Boolean).join("-");

export const SignerContext = React.createContext({});

export const Provider = ({ children }) => {
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState("idle");

  const { fid, account, address } = useFarcasterAccount();
  const cacheKey = createCacheKey(
    account?.address ?? fid?.toString() ?? address
  );
  const [signer, setCachedSigner] = useCachedState(cacheKey);
  const onChainSigner = useSignerByPublicKey(fid, signer?.publicKey);
  const [broadcasted, setBroadcasted] = React.useState(onChainSigner != null);
  const [addSignerTx, setAddSignerTx] = React.useState(null);
  const [revokeSignerTx, setRevokeSignerTx] = React.useState(null);

  const setSigner = useLatestCallback((keypair) => {
    setCachedSigner(keypair);
  });

  const reset = React.useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  const resetSigner = React.useCallback(() => {
    setSigner(null);
    setBroadcasted(false);
  }, [setSigner]);

  const createSigner = useLatestCallback(async () => {
    if (signer) return signer;

    const signerPrivateKey = EdDSAUtils.randomPrivateKey();
    return getPublicKeyAsync(signerPrivateKey)
      .then((publicKey) => {
        const createdSigner = {
          privateKey: bytesToHex(signerPrivateKey),
          publicKey: bytesToHex(publicKey),
        };
        setSigner(createdSigner);
        return createdSigner;
      })
      .catch((e) => {
        setError(e);
      });
  });

  const { writeAsync: createWalletAddSignerTransaction } = useContractWrite({
    address: DEFAULT_KEY_REGISTRY_ADDRESS,
    abi: parseAbi([
      "function add(uint32 keyType, bytes calldata key, uint8 metadataType, bytes calldata metadata) external",
    ]),
    chainId: DEFAULT_CHAIN_ID,
    functionName: "add",
  });

  const { config: walletRemoveSignerConfig } = usePrepareContractWrite({
    address: DEFAULT_KEY_REGISTRY_ADDRESS,
    abi: parseAbi(["function remove(bytes calldata key) external"]),
    chainId: DEFAULT_CHAIN_ID,
    functionName: "remove",
    args: [signer?.publicKey],
    // enabled: !!signer?.publicKey && !!broadcasted,
    enabled: false, // TODO: set this up properly when planning revoke signer feature
  });

  const { writeAsync: createWalletRemoveSignerTransaction } = useContractWrite(
    walletRemoveSignerConfig
  );

  const { isLoading: isAddSignerPending, isSuccess: isAddSignerSuccess } =
    useWaitForTransaction({
      hash: addSignerTx,
      onSuccess() {
        setBroadcasted(true);
        setAddSignerTx(null);
      },
    });

  const { isLoading: isRevokeSignerPending } = useWaitForTransaction({
    hash: revokeSignerTx,
    onSuccess() {
      resetSigner();
      setRevokeSignerTx(null);
    },
  });

  const createWarpcastSignKeyRequest = useLatestCallback(
    async ({ publicKey }) => {
      const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day
      setError(null);
      setStatus("requesting-signed-key-request");
      try {
        return await fetch(`${process.env.EDGE_API_BASE_URL}/farc-app`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: publicKey,
            deadline: deadline,
          }),
        })
          .then(async (res) => {
            return await res.json();
          })
          .then((data) => {
            return data.data.signature;
          })
          .then(async (signature) => {
            const res = await fetch(
              `${process.env.EDGE_API_BASE_URL}/farc-app`
            );
            const data = await res.json();
            return await fetch(`${warpcastApi}/v2/signed-key-requests`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                key: publicKey,
                requestFid: data.data.fid,
                signature,
                deadline,
              }),
            })
              .then((response) => {
                return response.json();
              })
              .then((response) => {
                return response.result.signedKeyRequest;
              });
          });
      } catch (e) {
        console.error(e);
        setError(e.message);
        return Promise.reject(e);
      } finally {
        setStatus("idle");
      }
    },
    [fid, signer]
  );

  const broadcastSigner = useLatestCallback(
    async ({ publicKey }) => {
      const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day
      setError(null);
      setStatus("requesting-signature");
      try {
        return await fetch(`${process.env.EDGE_API_BASE_URL}/farc-app`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: publicKey,
            deadline: deadline,
          }),
        })
          .then(async (res) => {
            return await res.json();
          })
          .then((data) => {
            return data.data.signature;
          })
          .then(async (signature) => {
            setStatus("requesting-transaction");
            const res = await fetch(
              `${process.env.EDGE_API_BASE_URL}/farc-app`
            );
            const data = await res.json();

            return await createWalletAddSignerTransaction({
              args: [
                1,
                publicKey,
                1,
                encodeAbiParameters(KEY_METADATA_TYPE, [
                  {
                    requestFid: BigInt(data.data.fid),
                    requestSigner: data.data.address,
                    signature: signature,
                    deadline: BigInt(deadline),
                  },
                ]),
              ],
              enabled: true,
            })
              .then((result) => {
                setStatus("waiting-broadcasting");
                setAddSignerTx(result?.hash);
                return result?.hash;
              })
              .catch((e) => {
                console.error(e);
                return Promise.reject(
                  new Error(
                    e.code === 32003
                      ? "transaction-rejected"
                      : "transaction-rejected-or-failed"
                  )
                );
              });
          })
          .catch((e) => {
            console.error(e);
            if (e.message.startsWith("transaction-rejected"))
              return Promise.reject(new Error(e.message));

            Promise.reject(
              new Error(
                e.code === 4001
                  ? "signature-rejected"
                  : "signature-rejected-or-failed"
              )
            );
          });
      } catch (e) {
        console.error(e);
        setError(e.message);
        return Promise.reject(e);
      } finally {
        setStatus("idle");
      }
    },
    [fid, signer]
  );

  const removeSigner = useLatestCallback(async () => {
    setError(null);
    setStatus("requesting-transaction");
    return await createWalletRemoveSignerTransaction()
      .then((result) => {
        setStatus("waiting-revoking");
        setRevokeSignerTx(result?.hash);
        return result?.hash;
      })
      .catch((e) => {
        setError("transaction-rejected-or-failed");
        console.error(e);
      })
      .finally(() => {
        setStatus("idle");
      });
  });

  React.useEffect(() => {
    if (!onChainSigner) setBroadcasted(false);
    else setBroadcasted(true);
  }, [onChainSigner]);

  const contextValue = React.useMemo(
    () => ({
      address,
      fid,
      signer,
      broadcasted,
      setBroadcasted,
      reset,
      error,
      createSigner,
      status,
      broadcastSigner,
      removeSigner,
      setSigner,
      resetSigner,
      isAddSignerPending,
      isAddSignerSuccess,
      isRevokeSignerPending,
      createWarpcastSignKeyRequest,
    }),
    [
      address,
      fid,
      signer,
      broadcasted,
      reset,
      error,
      createSigner,
      status,
      broadcastSigner,
      removeSigner,
      setSigner,
      resetSigner,
      isAddSignerPending,
      isAddSignerSuccess,
      isRevokeSignerPending,
      createWarpcastSignKeyRequest,
    ]
  );

  return (
    <SignerContext.Provider value={contextValue}>
      {children}
    </SignerContext.Provider>
  );
};

const useSigner = () => React.useContext(SignerContext);

export default useSigner;
