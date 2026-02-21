import { parseLyrics } from './components/player/parser/lyricParser.ts';
import * as fs from 'fs';

const kgData = JSON.parse(fs.readFileSync('./kg.json', 'utf8'));

// Test Kugou lyrics parsing
const track = {
    lyric: kgData.data.lyric,
    source: 'kugou'
};

const result = parseLyrics(track as any);
console.log('Result length:', result.length);
if (result.length > 0) {
    console.log('First line:', result[0]);
}
