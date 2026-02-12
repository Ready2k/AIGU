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

    // Sanitize newlines and normalize markers
    let text = children.replace(/\\n/g, '\n');

    // Handle "### " headers by making them bold and a bit larger
    // Handle "- " bullets by adding indentation (simple approach)

    const parts = [];
    let lastIndex = 0;

    // Bold Regex: **text** (handles multi-line with [\s\S])
    const boldRegex = /\*\*([\s\S]*?)\*\*/g;

    text.replace(boldRegex, (match, p1, offset) => {
        // Text before the match
        if (offset > lastIndex) {
            parts.push(renderItalics(text.substring(lastIndex, offset), lastIndex));
        }

        // The bold match (p1 is the content inside **)
        parts.push(
            <Text key={`b-${offset}`} style={{ fontWeight: 'bold' }}>
                {renderItalics(p1, offset + 2)}
            </Text>
        );

        lastIndex = offset + match.length;
        return match;
    });

    // Remaining text after last match
    if (lastIndex < text.length) {
        parts.push(renderItalics(text.substring(lastIndex), lastIndex));
    }

    return (
        <Text style={style} {...props}>
            {parts}
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
