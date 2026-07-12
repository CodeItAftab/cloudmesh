import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../Screens/LoginScreen";

const Stack = createNativeStackNavigator();

export function AuthNavigator({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onSignedIn={onSignedIn} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
