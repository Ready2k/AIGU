import React from 'react';
import { View, Text, Button } from 'react-native';

const DiscoveryCanvas = ({ actions }) => {
    return (
        <View style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 24 }}>Discovery Canvas</Text>
            <Text>Describe your project idea...</Text>
            {/* Input fields would go here */}
            <Button title="Submit to AIGU" onPress={() => actions.initiateIntake({ description: 'Demo Project' })} />
        </View>
    );
};

export default DiscoveryCanvas;
