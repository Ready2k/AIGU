import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useAiguTheme } from '../theme/ThemeContext';
import { useAiguState } from '../hooks/useAiguState';
import MarkdownText from '../components/MarkdownText';

/**
 * SupportAgent Component - Docked AI Assistant
 * 
 * Professional GIGC Guardrails:
 * - No jokes or entertainment
 * - No pirate talk or personas
 * - No governance bypass instructions
 * - Context-aware help based on current stage
 * - Provides actionable checklists
 */

const SupportAgent = ({ state, onClose, actions: providedActions, contextOverride }) => {
    const { theme } = useAiguTheme();

    // Use provided actions if available, fallback to new hook
    const hookState = useAiguState(state?.submissionId || 'temp', state?.userId || 'anonymous');
    const actions = providedActions || hookState.actions;
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef(null);

    // Initialize with context-aware greeting
    useEffect(() => {
        if (state && messages.length === 0) {
            let greeting = '';

            // If the backend LLM has provided a specific support message, use it
            if (state.ui_overlay?.supportMessage) {
                greeting = state.ui_overlay.supportMessage;
            } else {
                // Fallback to local synthesis if backend message is missing
                const stage = state.projectMetadata?.currentStage || 'Intake';
                const status = state.governance?.status || 'Draft';
                const blockers = state.governance?.blockers || [];
                const missingArtifacts = blockers
                    .filter(b => b.includes(': Missing '))
                    .map(b => b.split(': Missing ')[1]);

                greeting = `👋 Hello! I'm your GIGC Assistant.\n\n`;
                greeting += `**Current Status:** ${status}\n`;
                greeting += `**Stage:** ${stage}\n\n`;

                if (missingArtifacts.length > 0) {
                    greeting += `I noticed you need the following items:\n`;
                    missingArtifacts.forEach(artifact => {
                        greeting += `• ${artifact}\n`;
                    });
                    greeting += `\nWould you like guidance on any of these?`;
                } else if (status === 'In-Review') {
                    greeting += `Your project is currently under review. The GIGC team will respond within the SLA timeframe.`;
                } else if (status === 'Approved') {
                    greeting += `Congratulations! Your project has been approved. You can proceed to the next phase.`;
                } else {
                    greeting += `How can I help you with your governance submission today?`;
                }
            }

            setMessages([{
                id: '1',
                role: 'assistant',
                content: greeting,
                timestamp: new Date().toISOString()
            }]);
        }
    }, [state, messages.length]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        const userInput = input;
        setInput('');
        setLoading(true);

        try {
            // Call real LLM API with project context
            const response = await actions.askSupportAgent({
                message: userInput,
                context: {
                    submissionId: state?.submissionId,
                    stage: state?.projectMetadata?.currentStage,
                    status: state?.governance?.status,
                    blockers: state?.governance?.blockers || [],
                    artifacts: state?.artifacts,
                    projectMetadata: state?.projectMetadata,
                    auditLog: state?.auditLog,
                    tasks: state?.chainOfThought && state.chainOfThought.length > 0
                        ? state.chainOfThought[state.chainOfThought.length - 1].tasks
                        : [],
                    contextOverride: contextOverride
                }
            });

            const assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.message,
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Failed to get response:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'I apologize, but I encountered an error. Please try again or contact support.',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    // Clear messages when project changes
    useEffect(() => {
        setMessages([]);
    }, [state?.submissionId]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <View>
                    <Text style={{ ...theme.typography.subheader, color: theme.colors.textPrimary }}>
                        💬 GIGC Assistant
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, fontSize: 10 }}>
                        Professional Governance Support
                    </Text>
                </View>
                {onClose && (
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 24 }}>×</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Risk Summary Widget */}
            {state?.projectMetadata?.riskLevel && (
                <View style={{
                    padding: 12,
                    backgroundColor: theme.mode === 'dark' ? 'rgba(255, 165, 0, 0.15)' : '#FFF8E1',
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 16, marginRight: 6 }}>⚠️</Text>
                        <Text style={{ fontWeight: 'bold', color: theme.colors.warning }}>
                            Risk Level: {state.projectMetadata.riskLevel}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, lineHeight: 16 }}>
                        {state?.auditLog?.find(e => e.agent === 'Risk & Triage')?.reason || 'Assessment pending...'}
                    </Text>
                </View>
            )}

            {/* Messages */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={{ padding: 16 }}
            >
                {messages.map((message) => (
                    <View
                        key={message.id}
                        style={[
                            styles.messageBubble,
                            {
                                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                                backgroundColor: message.role === 'user'
                                    ? theme.colors.primary
                                    : theme.colors.background,
                                borderColor: message.role === 'user'
                                    ? theme.colors.primary
                                    : theme.colors.border
                            }
                        ]}
                    >
                        <MarkdownText style={{
                            ...theme.typography.body,
                            color: message.role === 'user' ? '#FFF' : theme.colors.textPrimary,
                            fontSize: 13,
                            lineHeight: 18
                        }}>
                            {message.content}
                        </MarkdownText>
                        <Text style={{
                            fontSize: 9,
                            color: message.role === 'user'
                                ? 'rgba(255,255,255,0.7)'
                                : theme.colors.textSecondary,
                            marginTop: 4
                        }}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                        </Text>
                    </View>
                ))}
                {loading && (
                    <View style={[styles.messageBubble, {
                        alignSelf: 'flex-start',
                        backgroundColor: theme.colors.background
                    }]}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                )}
            </ScrollView>

            {/* Input */}
            <View style={[styles.inputContainer, { borderTopColor: theme.colors.border }]}>
                <TextInput
                    style={[styles.input, {
                        backgroundColor: theme.colors.background,
                        color: theme.colors.textPrimary,
                        borderColor: theme.colors.border
                    }]}
                    placeholder="Ask me anything about governance..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={sendMessage}
                    multiline
                    maxLength={500}
                />
                <TouchableOpacity
                    style={[styles.sendButton, {
                        backgroundColor: input.trim() ? theme.colors.primary : theme.colors.border
                    }]}
                    onPress={sendMessage}
                    disabled={!input.trim() || loading}
                >
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Send</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1
    },
    messagesContainer: {
        flex: 1
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        borderTopWidth: 1,
        alignItems: 'flex-end'
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginRight: 8,
        maxHeight: 100,
        fontSize: 13
    },
    sendButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center'
    }
});

export default SupportAgent;
