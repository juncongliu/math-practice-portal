#!/usr/bin/env node
/**
 * push_worksheet.ts
 * Parse a math-tracker PDF worksheet and push it as an assignment to Supabase.
 *
 * Usage:
 *   node scripts/push_worksheet.ts <path-to-student-pdf> <path-to-answer-pdf> [title]
 *
 * Example:
 *   node scripts/push_worksheet.ts \
 *     ~/.math-tracker/cache/docs/WS_8.5_trig_applications.pdf \
 *     ~/.math-tracker/cache/docs/ANS_8.5_trig_applications.pdf \
 *     "Trig Applications — Angle of Elevation"
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import pdf from 'pdf-parse';

// ─── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PARENT_ID = process.env.PORTAL_PARENT_ID!; // pre-created parent UUID

// ─── PDF Parser ────────────────────────────────────────────────────────────────

interface ParsedProblem {
  id: string;
  text: string;
  answer: string;
  points: number;
}

async function parseWorksheetPdf(pdfPath: string): Promise<{ problems: ParsedProblem[] }> {
  const raw = readFileSync(pdfPath);
  const data = await pdf(raw);
  const text: string = data.text;

  // Extract questions from student PDF
  // The reportlab generator creates problems numbered like "1.", "2.", etc.
  // and optionally shows problem type labels
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const problems: ParsedProblem[] = [];
  let currentProblem: string[] = [];
  let problemNum = 0;

  for (const line of lines) {
    // Problem number pattern: "1.", "2.", "10.", etc.
    const numMatch = line.match(/^(\d+)\.\s*(.*)/);
    if (numMatch) {
      if (currentProblem.length > 0) {
        problems.push({
          id: `p${problemNum}`,
          text: currentProblem.join(' ').trim(),
          answer: '', // filled from answer key
          points: 1,
        });
      }
      problemNum = parseInt(numMatch[1]);
      currentProblem = [numMatch[2]];
    } else if (problemNum > 0) {
      currentProblem.push(line);
    }
  }

  // Last problem
  if (currentProblem.length > 0) {
    problems.push({
      id: `p${problemNum}`,
      text: currentProblem.join(' ').trim(),
      answer: '',
      points: 1,
    });
  }

  return { problems };
}

async function parseAnswerPdf(pdfPath: string): Promise<Record<string, string>> {
  // Answers are stored as lines: "1. Answer: 2x + 3 = 7" or just "2x + 3"
  const raw = readFileSync(pdfPath);
  const data = await pdf(raw);
  const text: string = data.text;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const answers: Record<string, string> = {};

  for (const line of lines) {
    // Match "1. Answer: x = 2" or "1. 2" or "1. x = 2"
    const m = line.match(/^(\d+)\.\s*(.+)/);
    if (m) {
      const num = m[1];
      let ans = m[2].trim();
      // Strip "Answer:" prefix if present
      ans = ans.replace(/^answer:\s*/i, '');
      answers[`p${num}`] = ans;
    }
  }

  return answers;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [, , studentPdfPath, answerPdfPath, ...titleParts] = process.argv;
  if (!studentPdfPath || !answerPdfPath) {
    console.error('Usage: node scripts/push_worksheet.ts <student-pdf> <answer-pdf> [title]');
    process.exit(1);
  }

  const title = titleParts.length > 0 ? titleParts.join(' ') : `Worksheet — ${new Date().toLocaleDateString()}`;

  console.log('📄 Parsing student PDF...');
  const { problems } = await parseWorksheetPdf(resolve(studentPdfPath));
  console.log(`   Found ${problems.length} problems`);

  console.log('🔑 Parsing answer PDF...');
  const answers = await parseAnswerPdf(resolve(answerPdfPath));
  console.log(`   Found ${Object.keys(answers).length} answers`);

  // Merge answers into problems
  for (const p of problems) {
    p.answer = answers[p.id] ?? '';
  }

  console.log('☁️  Pushing to Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      title,
      problems,
      created_by: PARENT_ID,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`✅ Assignment created: ${data.id}`);
  console.log(`   Title: ${title}`);
  console.log(`   Problems: ${problems.length}`);
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
