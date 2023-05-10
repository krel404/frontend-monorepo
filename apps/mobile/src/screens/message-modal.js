import { getAddress as checksumEncodeAddress } from "viem";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { View, Alert, Pressable, Text, Dimensions } from "react-native";
import * as Shades from "@shades/common";
import { SectionedActionList } from "./account-modal";
import { AddEmojiReaction as AddEmojiReactionIcon } from "../components/icons";
import theme from "../theme";

const { useActions, useSelectors, useMe, useMessage, useEmojis } = Shades.app;
const { message: messageUtils, ethereum: ethereumUtils } = Shades.utils;

const { truncateAddress } = ethereumUtils;

const hapticImpactLight = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const windowWidth = Dimensions.get("window").width;

const emojiColumnCount = 6;
const emojiColumnGutter = 7;
const emojiSize = (windowWidth - 32) / emojiColumnCount - emojiColumnGutter;

const MessageModal = ({
  dismiss,
  messageId,
  startEdit,
  startReply,
  showEmojiPicker,
  deleteMessage,
}) => {
  const actions = useActions();
  const selectors = useSelectors();
  const me = useMe();
  const message = useMessage(messageId);

  const { recentlyUsedEntries: recentEmojis } = useEmojis();

  const addReaction = (emoji) =>
    actions.addMessageReaction(messageId, { emoji });

  if (message == null) return null;

  const isOwnMessage = me.id === message.authorId;

  const actionSections = [
    {
      items: [
        isOwnMessage && {
          key: "edit-message",
          label: "Edit message",
          onPress: startEdit,
        },
        { key: "reply", label: "Reply", onPress: startReply },
        !message.isSystemMessage && {
          key: "copy-text",
          label: "Copy text",
          onPress: async () => {
            await Clipboard.setStringAsync(
              messageUtils.stringifyBlocks(message.blocks, {
                renderUser: (id) => {
                  const user = selectors.selectUser(id);
                  if (user == null || user.unknown) return "@[unknown-user]";
                  if (user.deleted) return "@[deleted-user]";
                  if (user.displayName != null) return `@${user.displayName}`;
                  if (user.walletAddress == null) return null;
                  const truncatedAddress = truncateAddress(
                    checksumEncodeAddress(user.walletAddress)
                  );
                  return `@${truncatedAddress}`;
                },
                renderChannelLink: (id) => {
                  const channel = selectors.selectChannel(id, { name: true });
                  return `#${channel?.name ?? `${id.slice(0, 8)}...`}`;
                },
              })
            );
            dismiss();
          },
        },
      ].filter(Boolean),
    },
    {
      items: [
        isOwnMessage
          ? {
              key: "delete-message",
              label: "Delete message",
              onPress: deleteMessage,
              danger: true,
            }
          : message.type === "regular" && {
              key: "report-message",
              label: "Report message",
              danger: true,
              onPress: () => {
                Alert.prompt(
                  "Report message",
                  "(Optional comment)",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Report",
                      style: "destructive",
                      onPress: async (comment) => {
                        try {
                          await actions.reportMessage(messageId, { comment });
                          dismiss();
                        } catch (e) {
                          e.response?.json().then((json) => {
                            Alert.alert(
                              "Error",
                              json?.detail ?? "Something went wrong"
                            );
                          });
                        }
                      },
                    },
                  ],
                  "plain-text"
                );
              },
            },
      ].filter(Boolean),
    },
  ].filter((s) => s.items.length > 0);

  return (
    <View
      style={{
        backgroundColor: "hsl(0,0%,10%)",
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 20,
      }}
    >
      <View
        style={{
          alignSelf: "center",
          width: 38,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: "hsl(0,0%,32%)",
          marginTop: 4,
          marginBottom: 14,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        {recentEmojis.slice(0, emojiColumnCount - 1).map((e) => (
          <Pressable
            key={e.emoji}
            onPress={() => {
              hapticImpactLight();
              addReaction(e.emoji);
              dismiss();
            }}
            style={({ pressed }) => ({
              width: emojiSize,
              height: emojiSize,
              borderRadius: emojiSize / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed
                ? theme.colors.backgroundLighter
                : theme.colors.backgroundLight,
            })}
          >
            <Text style={{ fontSize: 25, lineHeight: 30 }}>{e.emoji}</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            dismiss();
            hapticImpactLight();
            showEmojiPicker();
          }}
          style={({ pressed }) => ({
            width: emojiSize,
            height: emojiSize,
            borderRadius: emojiSize / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed
              ? theme.colors.backgroundLighter
              : theme.colors.backgroundLight,
          })}
        >
          <AddEmojiReactionIcon
            width="24"
            height="24"
            style={{ color: theme.colors.textDefault }}
          />
        </Pressable>
      </View>

      <SectionedActionList items={actionSections} />
    </View>
  );
};

export default MessageModal;
