import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import * as Shades from "@shades/common";
import theme from "../theme";
import { WEB_APP_ENDPOINT } from "../config";
import { SectionedActionList } from "./account-modal";
import { ChannelPicture } from "./channel-list";
import { Globe as GlobeIcon } from "../components/icons";

const {
  useActions,
  useMe,
  useChannel,
  useChannelName,
  useChannelAccessLevel,
  useChannelHasOpenReadAccess,
  useIsChannelStarred,
  useChannelPermissions,
} = Shades.app;

export const options = { headerShown: false };

const ChannelDetailsModal = ({ navigation, route }) => {
  const actions = useActions();
  const { channelId } = route.params;

  const me = useMe();
  const channel = useChannel(channelId);
  const channelName = useChannelName(channelId);
  const hasOpenReadAccess = useChannelHasOpenReadAccess(channelId);
  const channelPermissionType = useChannelAccessLevel(channelId);
  const isStarredChannel = useIsChannelStarred(channelId);
  const { canEditName, canEditDescription, canEditPicture, canAddMembers } =
    useChannelPermissions(channelId);
  const memberCount = channel?.memberUserIds.length;

  const isOwner = me.id === channel?.ownerUserId;
  const isMember = channel?.memberUserIds.includes(me.id);

  const [hasPendingJoinRequest, setPendingJoinRequest] = React.useState(false);
  const [hasPendingLeaveRequest, setPendingLeaveRequest] =
    React.useState(false);
  const [hasPendingStarRequest, setPendingStarRequest] = React.useState(false);
  const [isUpdatingPicture, setUpdatingPicture] = React.useState(false);

  const manageItems = [
    canAddMembers && {
      key: "add-members",
      label: "Add members",
      onPress: () => {
        navigation.navigate("Add members", { channelId });
      },
    },
    canEditName && {
      key: "edit-name",
      label: "Edit name",
      onPress: () => {
        Alert.prompt(
          "Edit channel name",
          undefined,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save",
              onPress: (name) => {
                if (channel.kind === "topic" && name.trim() === "") return;
                actions.updateChannel(channelId, { name: name.trim() });
              },
            },
          ],
          "plain-text",
          channel.name
        );
      },
    },
    canEditDescription && {
      key: "edit-description",
      label: "Edit topic",
      onPress: () => {
        Alert.prompt(
          "Edit channel topic",
          undefined,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save",
              onPress: (description) => {
                actions.updateChannel(channelId, {
                  description: description.trim(),
                });
              },
            },
          ],
          "plain-text",
          channel.description
        );
      },
    },
    canEditPicture && {
      key: "edit-picture",
      label: "Edit picture",
      isLoading: isUpdatingPicture,
      onPress: async () => {
        setUpdatingPicture(true);

        const result = await ImagePicker.launchImageLibraryAsync({
          quality: 1,
          allowsEditing: true,
          aspect: [1, 1],
        });

        if (result.canceled) {
          setUpdatingPicture(false);
          return;
        }

        const asset = result.assets[0];

        try {
          const blob = await fetch(asset.uri).then((r) => r.blob());

          const uploadedFiles = await actions.uploadImage({
            files: [
              {
                uri: asset.uri,
                type: blob.type,
                name: asset.fileName ?? asset.uri.split("/").slice(-1)[0],
              },
            ],
          });

          actions.updateChannel(channelId, {
            avatar: uploadedFiles[0].urls.large,
          });
        } catch (e) {
          Alert.alert("Error", e.message);
        } finally {
          setUpdatingPicture(false);
        }
      },
    },
  ].filter(Boolean);

  const actionList = [
    hasOpenReadAccess && {
      items: [
        {
          key: "read-access",
          label: "Open read access",
          icon: <GlobeIcon style={{ color: theme.colors.textDefault }} />,
          description: "Messages can be read by anyone",
          bordered: true,
          pressable: false,
        },
      ],
    },
    {
      items: [
        memberCount > 1 && {
          key: "copy-link",
          label: "Copy link",
          onPress: () => {
            Clipboard.setStringAsync(
              `${WEB_APP_ENDPOINT}/channels/${route.params.channelId}`
            ).then(() => {
              navigation.goBack();
            });
          },
        },
        {
          key: "star-channel",
          label: isStarredChannel ? "Unstar" : "Star",
          isLoading: hasPendingStarRequest,
          onPress: () => {
            setPendingStarRequest(true);
            const promise = isStarredChannel
              ? actions.unstarChannel(channelId)
              : actions.starChannel(channelId);
            promise.finally(() => {
              setPendingStarRequest(false);
            });
          },
        },
        memberCount > 0 &&
          (channel?.kind !== "dm" || memberCount > 1) && {
            key: "members",
            label: "Members",
            onPress: () => {
              navigation.navigate("Members", { channelId });
            },
          },
      ].filter(Boolean),
    },
    !isMember && {
      items: [
        {
          key: "join",
          label: "Join channel",
          disabled: channelPermissionType !== "open",
          isLoading: hasPendingJoinRequest,
          onPress: () => {
            setPendingJoinRequest(true);
            actions
              .joinChannel(channelId)
              .then(() => {
                navigation.goBack();
              })
              .finally(() => {
                setPendingJoinRequest(false);
              });
          },
        },
      ],
    },
    manageItems.length > 0 && {
      title: "Manage channel",
      items: manageItems,
    },
    {
      items: [
        channel?.kind === "topic" &&
          isMember && {
            key: "leave-channel",
            label: "Leave channel",
            danger: true,
            disabled: isOwner,
            isLoading: hasPendingLeaveRequest,
            onPress: async () => {
              const leaveChannel = async () => {
                setPendingLeaveRequest(true);

                try {
                  if (hasOpenReadAccess) {
                    await actions.leaveChannel(channelId);
                    navigation.goBack();
                    return;
                  }

                  if (isStarredChannel) await actions.unstarChannel(channelId);

                  await actions.leaveChannel(channelId);
                  navigation.popToTop();
                } finally {
                  setPendingLeaveRequest(false);
                }
              };

              Alert.alert(
                "Leave channel",
                "Are you sure you want to leave this channel?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Leave channel",
                    style: "destructive",
                    onPress: leaveChannel,
                  },
                ]
              );
            },
          },
        channel?.kind === "topic" &&
          isOwner && {
            key: "delete-channel",
            label: "Delete channel",
            danger: true,
            onPress: () => {
              const deleteChannel = () => {
                actions.deleteChannel(channelId);
                navigation.popToTop();
              };

              Alert.alert(
                "Delete channel",
                "Are you sure you want to delete this channel?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete channel",
                    style: "destructive",
                    onPress: deleteChannel,
                  },
                ]
              );
            },
          },
      ].filter(Boolean),
    },
  ].filter(Boolean);

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
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <View style={{ marginRight: 12 }}>
          <ChannelPicture channelId={route.params.channelId} size={38} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", minHeight: 38 }}>
          <Text
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: "600",
              lineHeight: 22,
              paddingTop: 2,
            }}
          >
            {channelName}
          </Text>
          {memberCount > 1 && (
            <Text
              style={{
                color: theme.colors.textDimmed,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 17,
                marginTop: 1,
              }}
            >
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </Text>
          )}
        </View>
      </View>

      <ScrollView>
        {channel?.description != null && (
          <View>
            <Text
              style={{
                color: theme.colors.textDimmed,
                fontSize: 14,
                fontWeight: "400",
                lineHeight: 18,
                marginBottom: 20,
              }}
            >
              {channel.description}
            </Text>
          </View>
        )}

        <SectionedActionList items={actionList} />
      </ScrollView>
    </View>
  );
};

export default ChannelDetailsModal;
