// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const editorUrl = 'http://localhost:3001';
const pdfPath = path.resolve(__dirname, '../素材/①自己成長（詳細スライド）成長エンジン起動0102261.pdf');
// Use compressed audio (original is 35MB, exceeds Whisper API 25MB limit)
const audioPath = path.resolve(__dirname, '../test-input/audio-compressed.mp3');

test.describe('AI Auto Marker E2E Test', () => {
  test.setTimeout(600000); // 10 minutes timeout for long operations

  test('should generate video with auto markers', async ({ page }) => {
    // Navigate to editor
    await page.goto(editorUrl);
    await expect(page).toHaveTitle('Slide Sync Editor');

    // Upload PDF
    console.log('Uploading PDF...');
    const pdfInput = page.locator('#pdfInput');
    await pdfInput.setInputFiles(pdfPath);

    // Wait for PDF to load (thumbnails should appear)
    await expect(page.locator('.thumbnail').first()).toBeVisible({ timeout: 30000 });
    console.log('PDF loaded successfully');

    // Upload Audio
    console.log('Uploading Audio...');
    const audioInput = page.locator('#audioInput');
    await audioInput.setInputFiles(audioPath);

    // Wait for audio to load (duration should update)
    await page.waitForFunction(() => {
      const duration = document.getElementById('duration');
      return duration && duration.textContent !== '0:00.000';
    }, { timeout: 30000 });
    console.log('Audio loaded successfully');

    // Step 1: PDF Analysis (Gemini)
    console.log('Starting PDF analysis with Gemini...');
    const analyzePdfBtn = page.locator('#analyzePdfBtn');
    await analyzePdfBtn.click();

    // Wait for analysis to complete (button should show done state)
    // Gemini PDF analysis can take 4-5 minutes for large PDFs
    await expect(analyzePdfBtn).toHaveClass(/done/, { timeout: 300000 });
    console.log('PDF analysis completed');

    // Step 2: Audio Transcription (Whisper)
    console.log('Starting audio transcription with Whisper...');
    const transcribeBtn = page.locator('#transcribeBtn');
    await transcribeBtn.click();

    // Wait for transcription to complete
    await expect(transcribeBtn).toHaveClass(/done/, { timeout: 300000 }); // 5 min for long audio
    console.log('Audio transcription completed');

    // Step 3: Auto Generate Markers
    console.log('Generating markers automatically...');
    const autoGenerateBtn = page.locator('#autoGenerateBtn');
    await expect(autoGenerateBtn).toBeEnabled();

    // Handle confirm dialog
    page.on('dialog', async dialog => {
      console.log('Dialog message:', dialog.message());
      await dialog.accept();
    });

    await autoGenerateBtn.click();

    // Wait for markers to be applied
    await expect(page.locator('.marker-item').first()).toBeVisible({ timeout: 120000 });
    console.log('Markers generated and applied');

    // Count markers
    const markerCount = await page.locator('.marker-item').count();
    console.log(`Total markers: ${markerCount}`);

    // Take screenshot before generating video
    await page.screenshot({ path: 'test-results/before-video-generation.png' });

    // Generate Video
    console.log('Starting video generation...');
    const generateBtn = page.locator('#generateBtn');

    // Handle download
    const downloadPromise = page.waitForEvent('download', { timeout: 600000 });
    await generateBtn.click();

    // Wait for loading modal to appear
    await expect(page.locator('#loadingModal')).toHaveClass(/active/, { timeout: 5000 });
    console.log('Video generation in progress...');

    // Wait for download
    const download = await downloadPromise;
    console.log('Video download started:', download.suggestedFilename());

    // Save to output folder
    const outputPath = path.resolve(__dirname, '../output/auto-marker-test-output.mp4');
    await download.saveAs(outputPath);
    console.log('Video saved to:', outputPath);

    // Take final screenshot
    await page.screenshot({ path: 'test-results/after-video-generation.png' });

    console.log('Test completed successfully!');
  });
});
