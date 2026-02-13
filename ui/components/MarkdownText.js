import React from 'react';
import { Text } from 'react-native';

/**
 * MarkdownText - A simple component to render basic markdown in React Native.
 * Currently supports:
 * - **bold**
 * - _italics_
 * - \n (newlines)
 */
const MarkdownText = ({ children, style, ...props }) => {
    if (!children) return null;
    if (typeof children !== 'string') return <Text style={style} {...props}>{children}</Text>;

    // Handle line-by-line processing for headers and bullets
    const text = children.replace(/\\n/g, '\n');
    const lines = text.split('\n');
    const processedLines = lines.map((line, i) => {
        let lineStyle = {};
        let prefix = "";

        // Header Check (### Title)
        if (line.trim().startsWith('### ')) {
            lineStyle = { fontWeight: '800', fontSize: 18, marginTop: 12, marginBottom: 8 };
            line = line.replace('### ', '');
        } else if (line.trim().startsWith('## ')) {
            lineStyle = { fontWeight: '800', fontSize: 20, marginTop: 16, marginBottom: 10 };
            line = line.replace('## ', '');
        } else if (line.trim().startsWith('# ')) {
            lineStyle = { fontWeight: '900', fontSize: 24, marginTop: 20, marginBottom: 12 };
            line = line.replace('# ', '');
        }

        // Bullet Check (- Item)
        if (line.trim().startsWith('- ')) {
            prefix = "• ";
            line = line.replace('- ', '');
        }

        const boldParts = [];
        let lineLastIndex = 0;
        const boldRegex = /\*\*([\s\S]*?)\*\*/g;

        line.replace(boldRegex, (match, p1, offset) => {
            if (offset > lineLastIndex) {
                boldParts.push(renderItalics(line.substring(lineLastIndex, offset), lineLastIndex));
            }
            boldParts.push(
                <Text key={`b-${i}-${offset}`} style={{ fontWeight: 'bold' }}>
                    {renderItalics(p1, offset + 2)}
                </Text>
            );
            lineLastIndex = offset + match.length;
            return match;
        });

        if (lineLastIndex < line.length) {
            boldParts.push(renderItalics(line.substring(lineLastIndex), lineLastIndex));
        }

        return (
            <Text key={`line-${i}`} style={[style, lineStyle]}>
                {prefix}{boldParts}{'\n'}
            </Text>
        );
    });

    return (
        <Text {...props}>
            {processedLines}
        </Text>
    );
};

const renderItalics = (text, parentOffset) => {
    if (typeof text !== 'string') return text;

    const parts = [];
    let lastIndex = 0;
    const italicRegex = /_([\s\S]*?)_/g;

    text.replace(italicRegex, (match, p1, offset) => {
        if (offset > lastIndex) {
            parts.push(text.substring(lastIndex, offset));
        }
        parts.push(
            <Text key={`i-${parentOffset}-${offset}`} style={{ fontStyle: 'italic' }}>
                {p1}
            </Text>
        );
        lastIndex = offset + match.length;
        return match;
    });

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts;
};

export default MarkdownText;
