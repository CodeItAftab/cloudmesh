// src/screens/onboarding/OnboardingScreen.tsx
import React, { useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native"; // Import Lottie
import { ONBOARDING_DATA, OnboardingPage } from "./data";

const { width, height } = Dimensions.get("window");

interface Props {
  onDone: () => Promise<void>;
}

export function OnboardingScreen({ onDone }: Props) {
  const flatListRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleMomentumScrollEnd = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / width);
    setActiveIndex(index);
  };

  const handleNext = () => {
    if (activeIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
      setActiveIndex(activeIndex + 1);
    } else {
      setLoading(true);
      onDone();
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: OnboardingPage }) => (
    <View
      style={[styles.pageContainer, { backgroundColor: item.backgroundColor }]}
    >
      {/* Conditional Media Renderer */}
      <View style={styles.mediaContainer}>
        <LottieView
          source={item.asset.source}
          autoPlay
          loop
          style={styles.mediaElement}
          renderMode="HARDWARE"
        />
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={ONBOARDING_DATA}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
      />

      <View style={styles.footer}>
        {/* Pagination Dots Layout */}
        <View style={styles.indicatorContainer}>
          {ONBOARDING_DATA.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });

            const dotColor = scrollX.interpolate({
              inputRange,
              outputRange: ["#E2E8F0", "#0066FF", "#E2E8F0"],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  { width: dotWidth, backgroundColor: dotColor },
                ]}
              />
            );
          })}
        </View>

        {/* Dynamic Action Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleNext}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {activeIndex === ONBOARDING_DATA.length - 1
              ? "Get Started"
              : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  pageContainer: {
    width,
    height: height * 0.72,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  mediaContainer: {
    width: width * 0.65,
    height: width * 0.65,
    marginBottom: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaElement: { width: "100%", height: "100%", resizeMode: "contain" },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    height: height * 0.18,
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 24,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: 32,
  },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  button: {
    backgroundColor: "#0066FF",
    paddingVertical: 16,
    width: width - 64,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
