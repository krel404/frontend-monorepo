import { getChecksumAddress } from "../utils/ethereum";

const commands = {
  "create-channel": ({ actions, navigate }) => ({
    description: "Start a new channel",
    arguments: ["name"],
    execute: async ({ args, editor }) => {
      const name = args.join(" ");
      if (name.trim().length === 0) {
        alert('"name" is a required argument!');
        return;
      }

      const channel = await actions.createPrivateChannel({ name });
      editor.clear();
      navigate(`/channels/${channel.id}`);
    },
  }),
  "set-channel-name": ({ context, user, state, actions, channelId }) => ({
    description: "Set a new name for this channel",
    arguments: ["channel-name"],
    execute: async ({ args, editor }) => {
      if (context !== "dm" && args.length < 1) {
        alert('Argument "channel-name" is required');
        return;
      }
      const channelName = args.join(" ");
      await actions.updateChannel(channelId, {
        name: channelName.trim() === "" ? null : channelName,
      });
      editor.clear();
    },
    exclude: () => {
      if (context === "dm") return false;

      if (context === "topic") {
        const channel = state.selectChannel(channelId);
        return user.id !== channel.ownerUserId;
      }

      return true;
    },
  }),
  "set-channel-topic": ({ context, user, state, actions, channelId }) => ({
    description: "Set a new topic for this channel",
    arguments: ["channel-topic"],
    execute: async ({ args, editor }) => {
      const description = args.join(" ");
      await actions.updateChannel(channelId, {
        description: description.trim() === "" ? null : description,
      });
      editor.clear();
    },
    exclude: () => {
      if (context === "dm") return false;

      if (context === "topic") {
        const channel = state.selectChannel(channelId);
        return channel?.ownerUserId !== user.id;
      }

      return true;
    },
  }),
  "set-channel-avatar": ({ context, user, state, actions, channelId }) => ({
    description: "Set a new avatar for this channel",
    arguments: ["channel-avatar-url"],
    execute: async ({ args, editor }) => {
      const arg = args[0]?.trim() === "" ? null : args[0];
      const isUrlOrEmpty = arg == null || arg.match(/^https?:\/\//);

      if (!isUrlOrEmpty) {
        alert(`"${arg}" is not a url!`);
        return;
      }

      await actions.updateChannel(channelId, { avatar: arg ?? null });
      editor.clear();
    },
    exclude: () => {
      if (context === "dm") return false;

      if (context === "topic") {
        const channel = state.selectChannel(channelId);
        return channel?.ownerUserId !== user.id;
      }

      return true;
    },
  }),
  "delete-channel": ({
    context,
    user,
    state,
    actions,
    navigate,
    channelId,
  }) => ({
    description: "Delete the current channel",
    execute: async ({ editor }) => {
      if (!confirm("Are you sure you want to delete this channel?")) return;
      await actions.deleteChannel(channelId);
      editor.clear();
      navigate("/");
    },
    exclude: () => {
      if (context === "dm") return true;

      if (context === "topic") {
        const channel = state.selectChannel(channelId);
        return user.id !== channel.ownerUserId;
      }

      return true;
    },
  }),
  "star-channel": ({ state, actions, channelId }) => ({
    description: "Star this channel to list it on your home screen",
    execute: async ({ editor }) => {
      const channels = state.selectStarredChannels();
      const isStarred = channels.some((c) => c.id === channelId);
      if (!isStarred) await actions.starChannel(channelId);
      editor.clear();
    },
    exclude: () => {
      const channels = state.selectStarredChannels();
      const isStarred = channels.some((c) => c.id === channelId);
      return isStarred;
    },
  }),
  "unstar-channel": ({ state, actions, channelId }) => ({
    description: "Unstar this channel to remove it from your home screen",
    execute: async ({ editor }) => {
      await actions.unstarChannel(channelId);
      editor.clear();
    },
    exclude: () => {
      const channels = state.selectStarredChannels();
      return channels.every((c) => c.id !== channelId);
    },
  }),
  "add-member": ({ state, actions, channelId, user, ethersProvider }) => ({
    description: "Add a member to this channel",
    arguments: ["wallet-address-or-ens"],
    execute: async ({ args, editor }) => {
      const walletAddressOrEnsList = args;
      if (walletAddressOrEnsList.length === 0) return;

      const addresses = [];

      for (let walletAddressOrEns of walletAddressOrEnsList) {
        try {
          const address = await ethersProvider
            .resolveName(walletAddressOrEns)
            .then(getChecksumAddress);
          addresses.push(address);
        } catch (e) {
          if (e.code === "INVALID_ARGUMENT")
            throw new Error(`Invalid address "${walletAddressOrEns}"`);
          throw e;
        }
      }

      await actions.addChannelMember(channelId, addresses);
      editor.clear();
    },
    exclude: () => {
      const channel = state.selectChannel(channelId);
      return channel.kind !== "topic" || channel.ownerUserId !== user.id;
    },
  }),
  "remove-member": ({ state, actions, channelId, user, ethersProvider }) => ({
    description: "Remove a member from this channel",
    arguments: ["wallet-address-or-ens"],
    execute: async ({ args, editor }) => {
      const [walletAddressOrEns] = args;
      if (walletAddressOrEns == null) return;

      try {
        const address = await ethersProvider
          .resolveName(walletAddressOrEns)
          .then(getChecksumAddress);

        const user = state.selectUserFromWalletAddress(address);

        if (user == null) {
          alert(`No member with address "${address}"!`);
          return;
        }

        await actions.removeChannelMember(channelId, user.id);
        editor.clear();
      } catch (e) {
        if (e.code === "INVALID_ARGUMENT") throw new Error("Invalid address");
        throw e;
      }
    },
    exclude: () => {
      const channel = state.selectChannel(channelId);
      return channel.kind !== "topic" || channel.ownerUserId !== user.id;
    },
  }),
  "join-channel": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId);
    const channelName = state.selectChannelName(channelId);
    return {
      description: `Join "#${channelName}".`,
      execute: async ({ editor }) => {
        await actions.joinChannel(channelId);
        editor.clear();
      },
      exclude: () =>
        channel.kind !== "topic" || channel.memberUserIds.includes(user.id),
    };
  },
  "leave-channel": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId);
    const channelName = state.selectChannelName(channelId);
    return {
      description: `Leave "#${channelName}".`,
      execute: async ({ editor }) => {
        await actions.leaveChannel(channelId);
        editor.clear();
      },
      exclude: () => {
        return channel.kind !== "topic" || channel.ownerUserId === user.id;
      },
    };
  },
  "make-open": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId);
    const channelName = state.selectChannelName(channelId);
    const accessLevel = state.selectChannelAccessLevel(channelId);
    return {
      description: `Make "#${channelName}" an open channel that anyone can see and join.`,
      execute: async ({ editor }) => {
        await actions.makeChannelOpen(channelId);
        editor.clear();
      },
      exclude: () =>
        accessLevel === "open" ||
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id ||
        (accessLevel === "private" && channel.memberUserIds.length > 1),
    };
  },
  "make-closed": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId);
    const channelName = state.selectChannelName(channelId);
    const accessLevel = state.selectChannelAccessLevel(channelId);
    return {
      description: `Make "#${channelName}" a closed channel that anyone can see, but not join.`,
      execute: async ({ editor }) => {
        await actions.makeChannelClosed(channelId);
        editor.clear();
      },
      exclude: () =>
        accessLevel === "closed" ||
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id ||
        (accessLevel === "private" && channel.memberUserIds.length > 1),
    };
  },
  "make-private": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId);
    const channelName = state.selectChannelName(channelId);
    const accessLevel = state.selectChannelAccessLevel(channelId);
    return {
      description: `Make "#${channelName}" a private channel that only members can see`,
      execute: async ({ editor }) => {
        await actions.makeChannelPrivate(channelId);
        editor.clear();
      },
      exclude: () =>
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id ||
        accessLevel === "private",
    };
  },
};

export default commands;
