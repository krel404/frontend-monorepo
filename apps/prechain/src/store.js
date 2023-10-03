import React from "react";
import { create as createZustandStoreHook } from "zustand";
import {
  parseAbi,
  stringToBytes,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  decodeEventLog,
} from "viem";
import {
  usePublicClient,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useSignTypedData,
  useNetwork,
  useBlockNumber,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { useFetch, useLatestCallback } from "@shades/common/react";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import {
  parse as parseTransactions,
  unparse as unparseTransactions,
} from "./utils/transactions.js";
import { useWallet } from "./hooks/wallet.js";

const { indexBy, sortBy } = arrayUtils;

export const ETH_TOKEN_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000000000";
export const USDC_TOKEN_CONTRACT_ADDRESS =
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
export const WETH_TOKEN_CONTRACT_ADDRESS =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
export const TOKEN_BUYER_CONTRACT =
  "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
export const DAO_PAYER_CONTRACT = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";
export const DAO_PROXY_CONTRACT = "0x6f3e6272a167e8accb32072d08e0957f9c79223d";
export const DAO_DATA_PROXY_CONTRACT =
  "0xf790a5f59678dd733fb3de93493a91f472ca1365";
export const DAO_TOKEN_CONTRACT = "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03";
export const DAO_AUCTION_HOUSE_PROXY_CONTRACT =
  "0x830bd73e4184cef73443c15111a1df14e495c706";
export const DAO_DESCRIPTOR_CONTRACT =
  "0x6229c811d04501523c6058bfaac29c91bb586268";

export const knownContracts = {
  [TOKEN_BUYER_CONTRACT]: {
    name: "DAO Token Buyer",
  },
  [DAO_PAYER_CONTRACT]: {
    name: "DAO Payer",
  },
  [DAO_PROXY_CONTRACT]: {
    name: "DAO Governance",
    description: "NounsDAOProxy",
  },
  [DAO_DATA_PROXY_CONTRACT]: {
    name: "DAO Candidates",
    description: "NounsDAODataProxy",
  },
  [DAO_TOKEN_CONTRACT]: {
    name: "Nouns Token",
  },
  [DAO_AUCTION_HOUSE_PROXY_CONTRACT]: {
    name: "Nouns Auction House",
    description: "NounsAuctionHouseProxy",
  },
  [DAO_DESCRIPTOR_CONTRACT]: {
    name: "Nouns Art",
    description: "NounsDescriptorV2",
  },
  [WETH_TOKEN_CONTRACT_ADDRESS]: {
    name: "WETH Token Contract",
  },
};

export const contractAddressesByChainId = {
  1: {
    dao: DAO_PROXY_CONTRACT,
    data: DAO_DATA_PROXY_CONTRACT,
    token: DAO_TOKEN_CONTRACT,
    payer: DAO_PAYER_CONTRACT,
    "token-buyer": TOKEN_BUYER_CONTRACT,
  },
  11155111: {
    dao: "0x35d2670d7C8931AACdd37C89Ddcb0638c3c44A57",
    data: "0x9040f720AA8A693F950B9cF94764b4b06079D002",
    token: "0x4C4674bb72a096855496a7204962297bd7e12b85",
    // payer: "0x0000000000000000000000000000000000000000",
    // "token-buyer": "0x0000000000000000000000000000000000000000",
  },
};

export const tokenByAddress = {
  [ETH_TOKEN_CONTRACT_ADDRESS]: "ETH",
  [WETH_TOKEN_CONTRACT_ADDRESS]: "WETH",
  [USDC_TOKEN_CONTRACT_ADDRESS]: "USDC",
};

const betaSubgraph =
  new URLSearchParams(location.search).get("beta-subgraph") != null;

const subgraphEndpointByChainId = {
  1: betaSubgraph
    ? "https://api.studio.thegraph.com/query/49498/nouns-v3-mainnet/version/latest"
    : "https://api.thegraph.com/subgraphs/name/nounsdao/nouns-subgraph",
  11155111:
    "https://api.studio.thegraph.com/proxy/49498/nouns-v3-sepolia/version/latest",
};

const DEFAULT_CHAIN_ID = 1;

const PROPDATE_FIELDS = `
fragment PropdateFields on PropUpdate {
  id
  update
  isCompleted
  admin
  blockNumber
  blockTimestamp
  prop {
    id
  }
}`;

const PROPDATES_QUERY = `
${PROPDATE_FIELDS}
query {
  propUpdates(orderBy: blockNumber, orderDirection: desc, first: 100) {
    ...PropdateFields
  }
}`;

const createPropdatesQuery = (proposalId) => `
${PROPDATE_FIELDS}
query {
  propUpdates(where: { prop: "${proposalId}" }, orderBy: blockNumber, orderDirection: desc, first: 100) {
    ...PropdateFields
  }
}`;

const VOTE_FIELDS = `
fragment VoteFields on Vote {
  id
  blockNumber
  reason
  supportDetailed
  votes
  voter {
    id
  }
}`;

const CANDIDATE_FEEDBACK_FIELDS = `
fragment CandidateFeedbackFields on CandidateFeedback {
  id
  reason
  supportDetailed
  createdBlock
  createdTimestamp
  votes
  voter {
    id
    nounsRepresented {
      id
    }
  }
  candidate {
    id
  }
}`;

const PROPOSAL_FEEDBACK_FIELDS = `
fragment ProposalFeedbackFields on ProposalFeedback {
  id
  reason
  supportDetailed
  createdBlock
  createdTimestamp
  votes
  voter {
    id
    nounsRepresented {
      id
    }
  }
  proposal {
    id
  }
}`;

export const useStore = createZustandStoreHook((set) => {
  const fetchProposalCandidatesFeedbackPosts = async (chainId, candidateIds) =>
    subgraphFetch({
      chainId,
      query:
        createProposalCandidateFeedbackPostsByCandidatesQuery(candidateIds),
    })
      .then((data) => {
        if (data.candidateFeedbacks == null)
          return Promise.reject(new Error("not-found"));
        return data.candidateFeedbacks;
      })
      .then((feedbackPosts) => {
        set((s) => {
          const feedbackPostsByCandidateId = arrayUtils.groupBy(
            (p) => p.candidate.id.toLowerCase(),
            feedbackPosts
          );
          const fetchedCandidatesById = objectUtils.mapValues(
            (feedbackPosts, id) => ({
              id,
              slug: extractSlugFromCandidateId(id),
              feedbackPosts: feedbackPosts.map(parseFeedbackPost),
            }),

            feedbackPostsByCandidateId
          );

          return {
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              fetchedCandidatesById
            ),
          };
        });
      });

  return {
    delegatesById: {},
    proposalsById: {},
    proposalCandidatesById: {},
    propdatesByProposalId: {},

    // UI actions
    addOptimitisicCandidateFeedbackPost: (candidateId, post) => {
      set((s) => {
        const candidate = s.proposalCandidatesById[candidateId];

        return {
          proposalCandidatesById: {
            ...s.proposalCandidatesById,
            [candidateId]: mergeProposalCandidates(candidate, {
              feedbackPosts: [{ ...post, candidateId, isPending: true }],
            }),
          },
        };
      });
    },

    // Actions
    fetchProposal: (chainId, id) =>
      subgraphFetch({ chainId, query: createProposalQuery(id) }).then(
        (data) => {
          if (data.proposal == null)
            return Promise.reject(new Error("not-found"));

          const fetchedProposal = parseProposal(data.proposal, { chainId });

          set((s) => ({
            proposalsById: {
              ...s.proposalsById,
              [id]: mergeProposals(s.proposalsById[id], fetchedProposal),
            },
          }));
        }
      ),
    fetchProposalCandidate: async (chainId, rawId) => {
      const id = rawId.toLowerCase();
      return Promise.all([
        subgraphFetch({
          chainId,
          query: createProposalCandidateQuery(id),
        }).then((data) => {
          if (data.proposalCandidate == null)
            return Promise.reject(new Error("not-found"));
          return data.proposalCandidate;
        }),
        subgraphFetch({
          chainId,
          query: createProposalCandidateFeedbackPostsByCandidateQuery(id),
        }).then((data) => {
          if (data.candidateFeedbacks == null)
            return Promise.reject(new Error("not-found"));
          return data.candidateFeedbacks;
        }),
      ]).then(([candidate, feedbackPosts]) => {
        set((s) => {
          const updatedCandidate = mergeProposalCandidates(
            s.proposalCandidatesById[id],
            parseProposalCandidate({ ...candidate, feedbackPosts }, { chainId })
          );
          return {
            proposalCandidatesById: {
              ...s.proposalCandidatesById,
              [id]: updatedCandidate,
            },
          };
        });
      });
    },
    fetchDelegates: (chainId) =>
      subgraphFetch({ chainId, query: DELEGATES_QUERY }).then((data) => {
        const parsedDelegates = data.delegates.map(parseDelegate);
        set(() => ({
          delegatesById: arrayUtils.indexBy((d) => d.id, parsedDelegates),
        }));
      }),
    fetchBrowseScreenData: (chainId, options) =>
      subgraphFetch({ chainId, query: createBrowseScreenQuery(options) }).then(
        (data) => {
          // Fetch feedback async
          fetchProposalCandidatesFeedbackPosts(
            chainId,
            data.proposalCandidates.map((c) => c.id.toLowerCase())
          );

          const parsedProposals = data.proposals.map((p) =>
            parseProposal(p, { chainId })
          );
          const fetchedProposalsById = indexBy((p) => p.id, parsedProposals);

          const parsedCandidates = data.proposalCandidates.map((c) =>
            parseProposalCandidate(c, { chainId })
          );
          const fetchedCandidatesById = indexBy(
            (p) => p.id.toLowerCase(),
            parsedCandidates
          );

          set((s) => ({
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              fetchedProposalsById
            ),
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              fetchedCandidatesById
            ),
          }));
        }
      ),
    fetchNounsActivity: (chainId, { startBlock, endBlock }) =>
      subgraphFetch({
        chainId,
        query: createNounsActivityDataQuery({
          startBlock: startBlock.toString(),
          endBlock: endBlock.toString(),
        }),
      }).then((data) => {
        if (data.candidateFeedbacks == null)
          return Promise.reject(new Error("not-found"));

        const candidateFeedbackPosts =
          data.candidateFeedbacks.map(parseFeedbackPost);
        const proposalFeedbackPosts =
          data.proposalFeedbacks.map(parseFeedbackPost);
        const { votes } = data;

        set((s) => {
          const postsByCandidateId = arrayUtils.groupBy(
            (p) => p.candidate.id.toLowerCase(),
            candidateFeedbackPosts
          );
          const newCandidatesById = objectUtils.mapValues(
            (feedbackPosts, candidateId) => ({
              id: candidateId,
              slug: extractSlugFromCandidateId(candidateId),
              feedbackPosts,
            }),
            postsByCandidateId
          );

          const feedbackPostsByProposalId = arrayUtils.groupBy(
            (p) => p.proposal.id,
            proposalFeedbackPosts
          );
          const votesByProposalId = arrayUtils.groupBy(
            (v) => v.proposal.id,
            votes
          );

          const proposalsWithNewFeedbackPostsById = objectUtils.mapValues(
            (feedbackPosts, proposalId) => ({
              id: proposalId,
              feedbackPosts,
            }),
            feedbackPostsByProposalId
          );
          const proposalsWithNewVotesById = objectUtils.mapValues(
            (votes, proposalId) => ({
              id: proposalId,
              votes,
            }),
            votesByProposalId
          );

          return {
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              proposalsWithNewFeedbackPostsById,
              proposalsWithNewVotesById
            ),
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              newCandidatesById
            ),
          };
        });
      }),
    fetchPropdates: (proposalId) =>
      subgraphFetch({
        endpoint: process.env.PROPDATES_SUBGRAPH_URL,
        query:
          proposalId == null
            ? PROPDATES_QUERY
            : createPropdatesQuery(proposalId),
      }).then((data) => {
        if (data.propUpdates == null) throw new Error("not-found");
        const parseUpdate = (u) => ({
          id: u.id,
          update: u.update.trim() === "" ? null : u.update.trim(),
          markedCompleted: u.isCompleted,
          blockNumber: BigInt(u.blockNumber),
          blockTimestamp: new Date(parseInt(u.blockTimestamp) * 1000),
          authorAccount: u.admin,
          proposalId: u.prop.id,
        });
        const parsedPropdates = data.propUpdates.map(parseUpdate);
        set(() => ({
          propdatesByProposalId: arrayUtils.groupBy(
            (d) => d.proposalId,
            parsedPropdates
          ),
        }));
      }),
  };
});

export const useChainId = () => {
  const { chain } = useNetwork();
  return chain?.id ?? DEFAULT_CHAIN_ID;
};

export const useContractAddress = (identifier) => {
  const chainId = useChainId();
  return contractAddressesByChainId[chainId][identifier];
};

const DELEGATES_QUERY = `{
  delegates(first: 1000, where: {nounsRepresented_: {}}) {
    id
    nounsRepresented {
      id
      seed {
        head
        glasses
        body
        background
        accessory
      }
    }
  }
}`;

const createBrowseScreenQuery = ({ skip = 0, first = 1000 } = {}) => `
${VOTE_FIELDS}
query {
  proposals(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}) {
    id
    description
    title
    status
    createdBlock
    createdTimestamp
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    executionETA
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      ...VoteFields
    }
  }

  proposalCandidates(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}) {
    id
    slug
    proposer
    createdBlock
    canceledBlock
    lastUpdatedBlock
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    latestVersion {
      id
      content {
        title
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          reason
          canceled
          expirationTimestamp
          signer {
            id
            nounsRepresented {
              id
            }
          }
        }
      }
    }
  }
}`;

const createProposalQuery = (id) => `
${VOTE_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
query {
  proposal(id: "${id}") {
    id
    status
    title
    description
    createdBlock
    createdTimestamp
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    targets
    signatures
    calldatas
    values
    forVotes
    againstVotes
    abstainVotes
    executionETA
    quorumVotes
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      ...VoteFields
    }
    feedbackPosts {
      ...ProposalFeedbackFields
    }
  }
}`;

const createProposalCandidateQuery = (id) => `{
  proposalCandidate(id: "${id}") {
    id
    slug
    proposer
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    createdBlock
    canceledBlock
    lastUpdatedBlock
    latestVersion {
      id
      content {
        title
        description
        targets
        values
        signatures
        calldatas
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          reason
          canceled
          expirationTimestamp
          signer {
            id
            nounsRepresented {
              id
            }
          }
        }
      }
    }
    versions {
      id
    }
  }
}`;

const createProposalCandidateFeedbackPostsByCandidateQuery = (candidateId) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_:{id: "${candidateId}"}}) {
    ...CandidateFeedbackFields
  }
}`;

const createProposalCandidateFeedbackPostsByCandidatesQuery = (
  candidateIds
) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_in: [${candidateIds.map(
    (id) => `"${id}"`
  )}]}, first: 1000) {
    ...CandidateFeedbackFields
  }
}`;

const createNounsActivityDataQuery = ({ startBlock, endBlock }) => `
${CANDIDATE_FEEDBACK_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
${VOTE_FIELDS}
query {
  candidateFeedbacks(where: {createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...CandidateFeedbackFields
  }
  proposalFeedbacks(where: {createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...ProposalFeedbackFields
  }
  votes(where: {blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...VoteFields
    proposal {
      id
    }
  }
}`;

export const ChainDataCacheContext = React.createContext();

const subgraphFetch = async ({
  endpoint,
  chainId,
  operationName,
  query,
  variables,
}) => {
  const url = endpoint ?? subgraphEndpointByChainId[chainId];

  if (url == null) throw new Error();

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationName, query, variables }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => body.data);
};

const parseFeedbackPost = (post) => ({
  ...post,
  createdBlock: BigInt(post.createdBlock),
  createdTimestamp: new Date(parseInt(post.createdTimestamp) * 1000),
  proposalId: post.proposal?.id,
  candidateId: post.candidate?.id,
});

const parseProposal = (data, { chainId }) => {
  const parsedData = { ...data };

  // Block numbers
  for (const prop of [
    "createdBlock",
    "startBlock",
    "endBlock",
    "updatePeriodEndBlock",
    "objectionPeriodEndBlock",
  ]) {
    if (data[prop] === "0") {
      parsedData[prop] = null;
    } else if (data[prop] != null) {
      parsedData[prop] = BigInt(data[prop]);
    }
  }

  // Timestamps
  for (const prop of ["createdTimestamp", "lastUpdatedTimestamp"]) {
    if (data[prop] != null) {
      parsedData[prop] = new Date(parseInt(data[prop]) * 1000);
    }
  }

  if (data.description != null) {
    const firstLine = data.description.split("\n")[0];
    const startIndex = [...firstLine].findIndex((c) => c !== "#");
    parsedData.title =
      startIndex === 0 ? null : firstLine.slice(startIndex).trim();
  }

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  if (data.proposer?.id != null) parsedData.proposerId = data.proposer.id;

  if (data.targets != null)
    parsedData.transactions = parseTransactions(data, { chainId });

  return parsedData;
};

const parseProposalCandidate = (data, { chainId }) => {
  const parsedData = {
    ...data,
    latestVersion: {
      ...data.latestVersion,
      content: { ...data.latestVersion.content },
    },
  };

  parsedData.proposerId = data.proposer;

  // Block numbers
  for (const prop of ["createdBlock", "canceledBlock", "lastUpdatedBlock"]) {
    if (data[prop] === "0") {
      parsedData[prop] = null;
    } else if (data[prop] != null) {
      parsedData[prop] = BigInt(data[prop]);
    }
  }

  // Timestamps
  for (const prop of [
    "createdTimestamp",
    "lastUpdatedTimestamp",
    "canceledTimestamp",
  ]) {
    if (data[prop] != null) {
      parsedData[prop] = new Date(parseInt(data[prop]) * 1000);
    }
  }

  if (data.latestVersion.content.matchingProposalIds != null)
    parsedData.latestVersion.proposalId =
      data.latestVersion.content.matchingProposalIds[0];

  if ((data.latestVersion.content.proposalIdToUpdate ?? "0") !== "0")
    parsedData.latestVersion.targetProposalId =
      data.latestVersion.content.proposalIdToUpdate;

  if (data.latestVersion.content.contentSignatures != null)
    parsedData.latestVersion.content.contentSignatures =
      data.latestVersion.content.contentSignatures.map((s) => ({
        ...s,
        expirationTimestamp: new Date(parseInt(s.expirationTimestamp) * 1000),
      }));

  if (data.latestVersion.content.targets != null)
    parsedData.latestVersion.content.transactions = parseTransactions(
      data.latestVersion.content,
      { chainId }
    );

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  return parsedData;
};

const parseDelegate = (data) => {
  const parsedData = { ...data };

  parsedData.nounsRepresented = arrayUtils.sortBy(
    (n) => parseInt(n.id),
    data.nounsRepresented.map((n) => ({
      ...n,
      seed: objectUtils.mapValues((v) => parseInt(v), n.seed),
    }))
  );

  return parsedData;
};

const mergeProposals = (p1, p2) => {
  if (p1 == null) return p2;

  const mergedProposal = { ...p1, ...p2 };

  if (p1.feedbackPosts != null && p2.feedbackPosts != null)
    mergedProposal.feedbackPosts = arrayUtils.unique(
      (p1, p2) => p1.id === p2.id,
      [...p1.feedbackPosts, ...p2.feedbackPosts]
    );

  if (p1.votes != null && p2.votes != null)
    mergedProposal.votes = arrayUtils.unique(
      (v1, v2) => v1.id === v2.id,
      [...p1.votes, ...p2.votes]
    );

  return mergedProposal;
};

const mergeProposalCandidates = (p1, p2) => {
  if (p1 == null) return p2;

  const mergedCandidate = { ...p1, ...p2 };

  if (p1.feedbackPosts != null && p2.feedbackPosts != null)
    mergedCandidate.feedbackPosts = arrayUtils.unique(
      (p1, p2) => {
        if (p1.id === p2.id) return true;
        if (!p1.isPending) return false;

        // Bit of a hack to clear optimistic entries without proper ids
        const [compositeId1, compositeId2] = [p1, p2].map((p) =>
          [p.proposalId, p.candidateId, p.reason, p.supportDetailed, p.voter.id]
            .join("-")
            .trim()
            .toLowerCase()
        );
        return compositeId1 === compositeId2;
      },
      // p2 has to be first here to take precedence
      [...p2.feedbackPosts, ...p1.feedbackPosts]
    );

  if (p1?.latestVersion == null || p2?.latestVersion == null)
    return mergedCandidate;

  mergedCandidate.latestVersion = { ...p1.latestVersion, ...p2.latestVersion };

  if (p2.latestVersion.content == null) return mergedCandidate;

  mergedCandidate.latestVersion.content = {
    ...p1.latestVersion.content,
    ...p2.latestVersion.content,
  };

  return mergedCandidate;
};

export const ChainDataCacheContextProvider = ({ children }) => {
  const chainId = useChainId();

  const fetchDelegates = useStore((s) => s.fetchDelegates);

  useFetch(() => fetchDelegates(chainId), [fetchDelegates, chainId]);

  return children;
};

export const extractSlugFromCandidateId = (candidateId) => {
  const slugParts = candidateId.split("-").slice(1);
  return slugParts.join("-");
};

export const getValidSponsorSignatures = (candidate) => {
  const signatures = candidate?.latestVersion?.content.contentSignatures ?? [];
  return arrayUtils
    .sortBy({ value: (i) => i.expirationTimestamp, order: "desc" }, signatures)
    .reduce((validSignatures, s) => {
      if (
        // Exclude canceled ones...
        s.canceled ||
        // ...expires ones
        s.expirationTimestamp <= new Date() ||
        // ...multiple ones from the same signer with shorter expiration
        validSignatures.some((s_) => s_.signer.id === s.signer.id)
      )
        // TODO: exclude signers who have an active or pending proposal
        return validSignatures;
      return [...validSignatures, s];
    }, []);
};

export const useDelegate = (id) =>
  useStore(React.useCallback((s) => s.delegatesById[id], [id]));

export const useActions = () => {
  const chainId = useChainId();
  const fetchProposal = useStore((s) => s.fetchProposal);
  const fetchProposalCandidate = useStore((s) => s.fetchProposalCandidate);
  const fetchNounsActivity = useStore((s) => s.fetchNounsActivity);
  const fetchBrowseScreenData = useStore((s) => s.fetchBrowseScreenData);
  const fetchPropdates = useStore((s) => s.fetchPropdates);

  return {
    fetchProposal: React.useCallback(
      (...args) => fetchProposal(chainId, ...args),
      [fetchProposal, chainId]
    ),
    fetchProposalCandidate: React.useCallback(
      (...args) => fetchProposalCandidate(chainId, ...args),
      [fetchProposalCandidate, chainId]
    ),
    fetchNounsActivity: React.useCallback(
      (...args) => fetchNounsActivity(chainId, ...args),
      [fetchNounsActivity, chainId]
    ),
    fetchBrowseScreenData: React.useCallback(
      (...args) => fetchBrowseScreenData(chainId, ...args),
      [fetchBrowseScreenData, chainId]
    ),
    fetchPropdates,
  };
};

export const useProposalCandidateFetch = (id, options) => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const onError = useLatestCallback(options?.onError);

  const { fetchProposalCandidate } = useActions();

  useFetch(
    () =>
      fetchProposalCandidate(id).catch((e) => {
        if (onError == null) return Promise.reject(e);
        onError(e);
      }),
    [fetchProposalCandidate, id, onError, blockNumber]
  );
};

export const useProposalCandidate = (id) =>
  useStore(
    React.useCallback(
      (s) => (id == null ? null : s.proposalCandidatesById[id.toLowerCase()]),
      [id]
    )
  );

export const useProposalCandidates = () => {
  const candidatesById = useStore((s) => s.proposalCandidatesById);
  return React.useMemo(() => {
    const candidates = Object.values(candidatesById);
    // Exclude canceled candidates as well as those with a matching proposal
    const filteredCandidates = candidates.filter(
      (c) => c.canceledTimestamp == null && c.latestVersion?.proposalId == null
    );
    return sortBy(
      { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
      filteredCandidates
    );
  }, [candidatesById]);
};

export const useSendProposalCandidateFeedback = (
  proposerId,
  slug,
  { support, reason }
) => {
  const chainId = useChainId();
  const { address: accountAddress } = useWallet();

  const addOptimitisicCandidateFeedbackPost = useStore(
    (s) => s.addOptimitisicCandidateFeedbackPost
  );

  const { data: blockNumber } = useBlockNumber();

  const { config } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function sendCandidateFeedback(address proposer, string memory slug, uint8 support, string memory reason) external",
    ]),
    functionName: "sendCandidateFeedback",
    args: [proposerId, slug, support, reason],
  });
  const { writeAsync: write } = useContractWrite(config);

  return async () => {
    const candidateId = [proposerId, slug].join("-").toLowerCase();
    return write().then(({ hash }) => {
      addOptimitisicCandidateFeedbackPost(candidateId, {
        id: String(Math.random()),
        reason,
        supportDetailed: support,
        createdTimestamp: new Date(),
        createdBlock: blockNumber,
        voter: { id: accountAddress.toLowerCase() },
      });
      return { hash };
    });
  };
};

export const useProposalCandidateVotingPower = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);
  const proposerDelegate = useDelegate(candidate.proposerId);

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];

  const validSignatures = getValidSponsorSignatures(candidate);

  const sponsoringNounIds = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id))
  );

  const candidateVotingPower = arrayUtils.unique([
    ...sponsoringNounIds,
    ...proposerDelegateNounIds,
  ]).length;

  return candidateVotingPower;
};

export const useCreateProposalCandidate = ({ enabled = true } = {}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // TODO: Only pay if account has no prior votes
  const createCost = useProposalCandidateCreateCost({ enabled });

  const { writeAsync } = useContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function createProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate) external payable",
    ]),
    functionName: "createProposalCandidate",
    value: createCost,
  });

  if (createCost == null) return null;

  return async ({ slug, description, transactions }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId }
    );

    return writeAsync({
      args: [targets, values, signatures, calldatas, description, slug, 0],
    })
      .then(({ hash }) => publicClient.waitForTransactionReceipt({ hash }))
      .then((receipt) => {
        const eventLog = receipt.logs[0];
        const decodedEvent = decodeEventLog({
          abi: parseAbi([
            "event ProposalCandidateCreated(address indexed msgSender, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description, string slug, uint256 proposalIdToUpdate, bytes32 encodedProposalHash)",
          ]),
          data: eventLog.data,
          topics: eventLog.topics,
        });
        return decodedEvent.args;
      });
  };
};

export const useProposalCandidateCreateCost = ({ enabled = true } = {}) => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function createCandidateCost() public view returns (uint256)",
    ]),
    functionName: "createCandidateCost",
    enabled,
  });

  return data;
};

export const useProposalCandidateUpdateCost = () => {
  const chainId = useChainId();

  const { data } = useContractRead({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function updateCandidateCost() public view returns (uint256)",
    ]),
    functionName: "updateCandidateCost",
  });

  return data;
};

export const useUpdateProposalCandidate = (
  slug,
  { description, reason, transactions }
) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const updateCost = useProposalCandidateUpdateCost();

  const { targets, values, signatures, calldatas } = unparseTransactions(
    transactions,
    { chainId }
  );

  const { config } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function updateProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate, string memory reason) external payable",
    ]),
    functionName: "updateProposalCandidate",
    args: [
      targets,
      values,
      signatures,
      calldatas,
      description,
      slug,
      0,
      reason,
    ],
    value: updateCost,
    enabled: description != null && updateCost != null,
  });
  const { writeAsync } = useContractWrite(config);

  return writeAsync == null
    ? null
    : () =>
        writeAsync().then(({ hash }) =>
          publicClient.waitForTransactionReceipt({ hash })
        );
};

export const useCancelProposalCandidate = (slug) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { config } = usePrepareContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function cancelProposalCandidate(string memory slug) external",
    ]),
    functionName: "cancelProposalCandidate",
    args: [slug],
    // value: parseEther("0.01"),
  });
  const { writeAsync: write } = useContractWrite(config);

  return write == null
    ? null
    : () =>
        write().then(({ hash }) =>
          publicClient.waitForTransactionReceipt({ hash })
        );
};

export const useSignProposalCandidate = (
  proposerId,
  { description, targets, values, signatures, calldatas },
  { expirationTimestamp }
) => {
  const chainId = useChainId();

  const { signTypedDataAsync } = useSignTypedData({
    domain: {
      name: "Nouns DAO",
      chainId: sepolia.id,
      verifyingContract: contractAddressesByChainId[chainId].dao,
    },
    types: {
      Proposal: [
        { name: "proposer", type: "address" },
        { name: "targets", type: "address[]" },
        { name: "values", type: "uint256[]" },
        { name: "signatures", type: "string[]" },
        { name: "calldatas", type: "bytes[]" },
        { name: "description", type: "string" },
        { name: "expiry", type: "uint256" },
      ],
    },
    primaryType: "Proposal",
    message: {
      proposer: proposerId,
      targets,
      values,
      signatures,
      calldatas,
      description,
      expiry: expirationTimestamp,
    },
  });

  return signTypedDataAsync;
};

const calcProposalEncodeData = ({
  proposerId,
  description,
  targets,
  values,
  signatures,
  calldatas,
}) => {
  const signatureHashes = signatures.map((sig) =>
    keccak256(stringToBytes(sig))
  );

  const calldatasHashes = calldatas.map((calldata) => keccak256(calldata));

  const encodedData = encodeAbiParameters(
    ["address", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32"].map(
      (type) => ({ type })
    ),
    [
      proposerId,
      keccak256(encodePacked(["address[]"], [targets])),
      keccak256(encodePacked(["uint256[]"], [values])),
      keccak256(encodePacked(["bytes32[]"], [signatureHashes])),
      keccak256(encodePacked(["bytes32[]"], [calldatasHashes])),
      keccak256(stringToBytes(description)),
    ]
  );

  return encodedData;
};

export const useAddSignatureToProposalCandidate = (
  proposerId,
  slug,
  { description, targets, values, signatures, calldatas }
) => {
  const chainId = useChainId();

  const { writeAsync } = useContractWrite({
    address: contractAddressesByChainId[chainId].data,
    abi: parseAbi([
      "function addSignature(bytes memory sig, uint256 expirationTimestamp, address proposer, string memory slug, uint256 proposalIdToUpdate, bytes memory encodedProp, string memory reason) external",
    ]),
    functionName: "addSignature",
  });

  return ({ signature, expirationTimestamp, reason }) =>
    writeAsync({
      args: [
        signature,
        expirationTimestamp,
        proposerId,
        slug,
        0, // proposalIdToUpdate,
        calcProposalEncodeData({
          proposerId,
          description,
          targets,
          values,
          signatures,
          calldatas,
        }),
        reason,
      ],
    });
};
