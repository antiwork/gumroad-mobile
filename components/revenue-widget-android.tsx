import { FlexWidget, TextWidget } from "react-native-android-widget";

const RevenueRow = ({ label, value }: { label: string; value: string }) => (
  <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
    <TextWidget
      text={label}
      style={{ fontSize: 13, fontFamily: "ABCFavorit-Regular-custom", color: "#ffffff" }}
    />
    <FlexWidget style={{ flex: 1 }} />
    <TextWidget
      text={value}
      style={{ fontSize: 13, fontFamily: "ABCFavorit-Bold-custom", fontWeight: "bold", color: "#ffffff" }}
    />
  </FlexWidget>
);

export const RevenueWidgetAndroid = ({
  today,
  week,
  month,
  year,
  isLoggedIn,
  hasError,
}: {
  today: string;
  week: string;
  month: string;
  year: string;
  isLoggedIn: boolean;
  hasError: boolean;
}) => {
  if (!isLoggedIn) {
    return (
      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000000",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <TextWidget
          text="Open Gumroad to log in"
          style={{ fontSize: 13, fontFamily: "ABCFavorit-Bold-custom", fontWeight: "bold", color: "#ffffff" }}
        />
      </FlexWidget>
    );
  }

  if (hasError) {
    return (
      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000000",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <TextWidget
          text="Sorry, something went wrong. Try again later."
          style={{ fontSize: 13, fontFamily: "ABCFavorit-Regular-custom", color: "#ffffff", textAlign: "center" }}
        />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        backgroundColor: "#000000",
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 14,
      }}
    >
      <TextWidget
        text="Gumroad Totals"
        style={{ fontSize: 15, fontFamily: "ABCFavorit-Bold-custom", fontWeight: "bold", color: "#ffffff" }}
      />
      <FlexWidget style={{ height: 16 }} />
      <FlexWidget style={{ flexDirection: "column", flexGap: 8, width: "match_parent" }}>
        <RevenueRow label="Today" value={today} />
        <RevenueRow label="Week" value={week} />
        <RevenueRow label="Month" value={month} />
        <RevenueRow label="Year" value={year} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1 }} />
    </FlexWidget>
  );
};
