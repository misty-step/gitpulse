/**
 * Compression utilities for API responses
 */
import { NextRequest, NextResponse } from 'next/server';
import { createGzip, createDeflate, createBrotliCompress, gzip, deflate, brotliCompress } from 'zlib';
import { promisify } from 'util';

// Promisify compression functions
const gzipPromise = promisify(gzip);
const deflatePromise = promisify(deflate);
const brotliPromise = promisify(brotliCompress);

/**
 * Determines if a response should be compressed based on:
 * 1. Client accept-encoding header
 * 2. Response content type
 * 3. Response size
 * 
 * @param request - The NextRequest object
 * @param response - The response body
 * @returns boolean - Whether compression should be applied
 */
export function shouldCompress(request: NextRequest, responseBody: string): boolean {
  // Don't compress if response is too small (< 1KB)
  if (responseBody.length < 1024) {
    return false;
  }

  // Check if the client accepts compression
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  
  // Only compress if client accepts at least one compression format
  return (
    acceptEncoding.includes('gzip') ||
    acceptEncoding.includes('deflate') ||
    acceptEncoding.includes('br')
  );
}

/**
 * Choose the best compression method based on the client's accept-encoding header
 * 
 * @param acceptEncoding - The accept-encoding header value
 * @returns string - The chosen compression method
 */
export function getBestCompressionMethod(acceptEncoding: string = ''): 'gzip' | 'deflate' | 'br' | null {
  // Prefer Brotli for best compression if supported
  if (acceptEncoding.includes('br')) {
    return 'br';
  }
  
  // Next best is gzip (most widely supported)
  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }
  
  // Deflate as fallback
  if (acceptEncoding.includes('deflate')) {
    return 'deflate';
  }
  
  // No supported compression method
  return null;
}

/**
 * Compresses the response body using the specified method
 * 
 * @param body - The response body as string
 * @param method - The compression method to use
 * @returns Promise<Buffer> - The compressed body
 */
export async function compressBody(body: string, method: 'gzip' | 'deflate' | 'br'): Promise<Buffer> {
  const buffer = Buffer.from(body, 'utf-8');
  
  switch (method) {
    case 'gzip':
      return await gzipPromise(buffer);
    case 'deflate':
      return await deflatePromise(buffer);
    case 'br':
      return await brotliPromise(buffer);
    default:
      throw new Error(`Unsupported compression method: ${method}`);
  }
}

/**
 * Creates a compressed NextResponse with appropriate headers
 * 
 * @param data - The data to compress and send
 * @param request - The original NextRequest
 * @param status - The HTTP status code
 * @param headers - Additional headers to include
 * @returns NextResponse - The compressed response
 */
export async function compressedJsonResponse(
  data: any,
  request: NextRequest,
  status: number = 200,
  headers: Record<string, string> = {}
): Promise<NextResponse> {
  // Stringify the data
  const jsonString = JSON.stringify(data);
  
  // Check if we should compress
  if (!shouldCompress(request, jsonString)) {
    // Return uncompressed response
    return NextResponse.json(data, { status, headers });
  }
  
  // Determine best compression method
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const compressionMethod = getBestCompressionMethod(acceptEncoding);
  
  if (!compressionMethod) {
    // No supported compression method, return uncompressed
    return NextResponse.json(data, { status, headers });
  }
  
  try {
    // Compress the response body
    const compressedBody = await compressBody(jsonString, compressionMethod);
    
    // Create response with compressed body and appropriate headers
    // NextResponse accepts Buffer directly as BodyInit
    return new NextResponse(compressedBody as any, {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': compressionMethod,
        // Add any additional headers
        ...headers
      }
    });
  } catch (error) {
    console.error('Error compressing response:', error);
    // Fallback to uncompressed response
    return NextResponse.json(data, { status, headers });
  }
}