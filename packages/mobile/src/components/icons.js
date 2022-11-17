import Svg, { Path } from "react-native-svg";

export const Emoji = (props) => (
  <Svg width="20" height="20" viewBox="0 0 20 20" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2.5 10a7.5 7.5 0 1 1 15 0 7.5 7.5 0 0 1-15 0ZM10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM7.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM14 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-6.385 3.766a.75.75 0 1 0-1.425.468C6.796 14.08 8.428 15 10.027 15c1.599 0 3.23-.92 3.838-2.766a.75.75 0 1 0-1.425-.468c-.38 1.155-1.38 1.734-2.413 1.734s-2.032-.58-2.412-1.734Z"
      clipRule="evenodd"
    />
  </Svg>
);

export const Globe = (props) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.44 4 16.08 4 12C4 11.38 4.08 10.79 4.21 10.21L9 15V16C9 17.1 9.9 18 11 18V19.93ZM17.9 17.39C17.64 16.58 16.9 16 16 16H15V13C15 12.45 14.55 12 14 12H8V10H10C10.55 10 11 9.55 11 9V7H13C14.1 7 15 6.1 15 5V4.59C17.93 5.78 20 8.65 20 12C20 14.08 19.2 15.97 17.9 17.39Z"
      fill="currentColor"
    />
  </Svg>
);

export const Lock = (props) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M6 22C5.45 22 4.97933 21.8043 4.588 21.413C4.196 21.021 4 20.55 4 20V10C4 9.45 4.196 8.979 4.588 8.587C4.97933 8.19567 5.45 8 6 8H7V6C7 4.61667 7.48767 3.43733 8.463 2.462C9.43767 1.48733 10.6167 1 12 1C13.3833 1 14.5627 1.48733 15.538 2.462C16.5127 3.43733 17 4.61667 17 6V8H18C18.55 8 19.021 8.19567 19.413 8.587C19.8043 8.979 20 9.45 20 10V20C20 20.55 19.8043 21.021 19.413 21.413C19.021 21.8043 18.55 22 18 22H6ZM6 20H18V10H6V20ZM12 17C12.55 17 13.021 16.8043 13.413 16.413C13.8043 16.021 14 15.55 14 15C14 14.45 13.8043 13.979 13.413 13.587C13.021 13.1957 12.55 13 12 13C11.45 13 10.9793 13.1957 10.588 13.587C10.196 13.979 10 14.45 10 15C10 15.55 10.196 16.021 10.588 16.413C10.9793 16.8043 11.45 17 12 17ZM9 8H15V6C15 5.16667 14.7083 4.45833 14.125 3.875C13.5417 3.29167 12.8333 3 12 3C11.1667 3 10.4583 3.29167 9.875 3.875C9.29167 4.45833 9 5.16667 9 6V8ZM6 20V10V20Z"
      fill="currentColor"
    />
  </Svg>
);

export const EyeOff = (props) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M22.0828 11.3953C21.2589 9.65954 20.2785 8.24391 19.1414 7.14844L17.9489 8.34094C18.9213 9.27024 19.7684 10.4859 20.5008 12C18.5508 16.0359 15.7828 17.9531 12 17.9531C10.8645 17.9531 9.81869 17.7783 8.86244 17.4286L7.57033 18.7207C8.89845 19.334 10.375 19.6406 12 19.6406C16.5047 19.6406 19.8656 17.2945 22.0828 12.6023C22.172 12.4136 22.2182 12.2075 22.2182 11.9988C22.2182 11.7901 22.172 11.584 22.0828 11.3953ZM20.5929 3.88032L19.5938 2.88C19.5763 2.86257 19.5557 2.84874 19.5329 2.8393C19.5101 2.82987 19.4857 2.82501 19.4611 2.82501C19.4365 2.82501 19.4121 2.82987 19.3893 2.8393C19.3665 2.84874 19.3459 2.86257 19.3285 2.88L16.7651 5.44219C15.3518 4.72032 13.7635 4.35938 12 4.35938C7.49533 4.35938 4.13439 6.70547 1.9172 11.3977C1.82808 11.5864 1.78186 11.7925 1.78186 12.0012C1.78186 12.2099 1.82808 12.416 1.9172 12.6047C2.80298 14.4703 3.86939 15.9657 5.11642 17.0909L2.63626 19.5703C2.60113 19.6055 2.58139 19.6531 2.58139 19.7029C2.58139 19.7526 2.60113 19.8002 2.63626 19.8354L3.63681 20.8359C3.67197 20.8711 3.71964 20.8908 3.76935 20.8908C3.81906 20.8908 3.86673 20.8711 3.90189 20.8359L20.5929 4.14563C20.6103 4.12821 20.6242 4.10754 20.6336 4.08477C20.643 4.06201 20.6479 4.03761 20.6479 4.01297C20.6479 3.98833 20.643 3.96393 20.6336 3.94117C20.6242 3.91841 20.6103 3.89773 20.5929 3.88032ZM3.49923 12C5.45158 7.96407 8.21954 6.04688 12 6.04688C13.2783 6.04688 14.4406 6.26625 15.495 6.71227L13.8474 8.35993C13.067 7.94359 12.1736 7.78907 11.2988 7.91917C10.424 8.04927 9.61413 8.4571 8.98874 9.08248C8.36336 9.70787 7.95553 10.5177 7.82543 11.3925C7.69533 12.2673 7.84985 13.1608 8.26618 13.9411L6.31103 15.8963C5.22892 14.9412 4.29611 13.6472 3.49923 12ZM9.28126 12C9.28167 11.5867 9.37957 11.1794 9.56699 10.811C9.75442 10.4427 10.0261 10.1237 10.3599 9.8801C10.6938 9.63648 11.0804 9.47504 11.4883 9.4089C11.8963 9.34276 12.3141 9.37379 12.7078 9.49946L9.40572 12.8016C9.32295 12.5424 9.28096 12.272 9.28126 12Z"
      fill="currentColor"
    />
    <Path
      d="M11.9062 14.625C11.8251 14.625 11.7452 14.6212 11.666 14.614L10.428 15.8519C11.1726 16.1371 11.9839 16.2005 12.7637 16.0344C13.5435 15.8683 14.2586 15.4799 14.8224 14.9161C15.3862 14.3523 15.7746 13.6373 15.9406 12.8575C16.1067 12.0776 16.0433 11.2664 15.7582 10.5218L14.5202 11.7598C14.5275 11.839 14.5312 11.9189 14.5312 12C14.5314 12.3448 14.4637 12.6862 14.3318 13.0048C14.2 13.3233 14.0066 13.6128 13.7628 13.8566C13.519 14.1004 13.2296 14.2937 12.911 14.4256C12.5924 14.5574 12.251 14.6252 11.9062 14.625Z"
      fill="currentColor"
    />
  </Svg>
);
