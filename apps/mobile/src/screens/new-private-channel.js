import React from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  LayoutAnimation,
  Pressable,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Shades from "@shades/common";
import theme from "../theme";
import { UserListItem, useFilteredUsers } from "./new-chat";
import Input from "../components/input";
import { HorizontalUserListItem } from "./new-closed-channel";

const { useMe } = Shades.app;
const { useLatestCallback } = Shades.react;

export const options = {
  headerTintColor: theme.colors.textDefault,
  title: "New Private Chat",
  headerRight: (props) => (
    <HeaderRight {...props} button={{ label: "Next", disabled: true }} />
  ),
};

const HeaderRight = ({ button: { label, disabled, onPress } }) => (
  <View>
    <Pressable disabled={disabled} onPress={onPress}>
      <Text
        style={{
          color: disabled ? theme.colors.textDimmed : theme.colors.textBlue,
          fontSize: 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  </View>
);

const NewPrivate = ({ navigation }) => {
  const membersScrollViewRef = React.useRef();

  const me = useMe();

  const inputRef = React.useRef();

  const [members, setMembers] = React.useState([]);
  const hasMembers = members.length !== 0;

  const [pendingInput, setPendingInput] = React.useState("");

  const { users: filteredUsers, isLoading: isLoadingUsers } = useFilteredUsers({
    query: pendingInput,
  });

  const toggleMember = useLatestCallback((address) => {
    if (members.length === 0)
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setMembers((ms) => {
      const nextMembers = ms.includes(address)
        ? ms.filter((a) => a !== address)
        : [...ms, address];

      const addedMember = nextMembers.length > ms.length;
      if (addedMember) {
        // Without the timeout the new item won’t yet be included
        setTimeout(() => {
          membersScrollViewRef.current?.scrollToEnd({ animated: true });
        });
      }

      return nextMembers;
    });
  });

  const removeMember = useLatestCallback((address) => {
    if (members.length === 1 && address === members[0])
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    return setMembers((ms) => ms.filter((a) => a !== address));
  });

  React.useLayoutEffect(() => {
    const hasMembers = members.length !== 0;
    navigation.setOptions({
      headerRight: () => (
        <HeaderRight
          button={{
            label: "Next",
            disabled: !hasMembers,
            onPress: () =>
              navigation.navigate("New Group", { members, type: "private" }),
          }}
        />
      ),
    });
  }, [members, navigation]);

  return (
    <View style={{ flex: 1 }}>
      {hasMembers && (
        <View>
          <ScrollView
            ref={membersScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 11, paddingHorizontal: 8 }}
            style={{ width: "100%" }}
          >
            {members.map((address) => (
              <HorizontalUserListItem
                key={address}
                address={address}
                onPress={() => {
                  removeMember(address);
                }}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, paddingBottom: 5 }}>
        <Input
          ref={inputRef}
          autoFocus
          value={pendingInput}
          placeholder="ENS or wallet address"
          onChangeText={setPendingInput}
          keyboardType="web-search"
        />
        {/* <Text style={{ marginTop: 16, color: "hsl(0,0%,50%)", fontSize: 14 }}> */}
        {/*   Find groups Add members by their ENS name or wallet address. */}
        {/* </Text> */}
      </View>

      <FlatList
        data={[
          isLoadingUsers && { type: "loader" },
          ...filteredUsers.map((u) => {
            const isMe =
              me.walletAddress.toLowerCase() === u.walletAddress.toLowerCase();
            const isSelected =
              isMe || members.includes(u.walletAddress.toLowerCase());

            return { ...u, isSelected, isMe };
          }),
        ].filter(Boolean)}
        keyExtractor={(item) => (item.type === "loader" ? "loader" : item.id)}
        renderItem={({ item }) => {
          switch (item.type) {
            case "loader":
              return (
                <View
                  style={{
                    height: 61,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: theme.colors.textDimmed }}>
                    Loading...
                  </Text>
                </View>
              );
            default:
              return (
                <UserListItem
                  address={item.walletAddress}
                  displayName={item.displayName}
                  ensName={item.ensName}
                  onSelect={() => {
                    toggleMember(item.walletAddress.toLowerCase());
                  }}
                  disabled={item.isMe}
                  rightColumn={
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: item.isSelected
                          ? theme.colors.textBlue
                          : "hsl(0,0%,20%)",
                        backgroundColor: item.isSelected
                          ? theme.colors.textBlue
                          : undefined,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.isSelected && (
                        <Svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="hsl(0,0%,10%)"
                        >
                          <Path d="M6.6123 14.2646C7.07715 14.2646 7.43945 14.0869 7.68555 13.7109L14.0566 3.96973C14.2344 3.69629 14.3096 3.44336 14.3096 3.2041C14.3096 2.56152 13.8311 2.09668 13.1748 2.09668C12.7236 2.09668 12.4434 2.26074 12.1699 2.69141L6.57812 11.5098L3.74121 7.98926C3.48828 7.68848 3.21484 7.55176 2.83203 7.55176C2.16895 7.55176 1.69043 8.02344 1.69043 8.66602C1.69043 8.95312 1.7793 9.20605 2.02539 9.48633L5.55273 13.7588C5.84668 14.1074 6.1748 14.2646 6.6123 14.2646Z" />
                        </Svg>
                      )}
                    </View>
                  }
                />
              );
          }
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 5, paddingBottom: 20 }}
      />
    </View>
  );
};

export default NewPrivate;
