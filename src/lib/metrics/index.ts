/**
 * Metrics collection and reporting
 *
 * Provides in-memory metrics tracking with optional Prometheus export.
 * Supports counters, gauges, and histograms for observability.
 */

import { logger } from '../logger';

const MODULE_NAME = 'metrics';

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
}

/**
 * Counter metric - monotonically increasing value
 */
interface Counter {
  type: MetricType.COUNTER;
  value: number;
  labels: Record<string, string>;
}

/**
 * Gauge metric - can go up or down
 */
interface Gauge {
  type: MetricType.GAUGE;
  value: number;
  labels: Record<string, string>;
}

/**
 * Histogram metric - tracks distribution of values
 */
interface Histogram {
  type: MetricType.HISTOGRAM;
  count: number;
  sum: number;
  buckets: Map<number, number>; // bucket upper bound -> count
  labels: Record<string, string>;
}

/**
 * Union of all metric types
 */
type Metric = Counter | Gauge | Histogram;

/**
 * Metrics registry
 */
class MetricsRegistry {
  private metrics: Map<string, Metric> = new Map();
  private enabled: boolean;

  constructor() {
    // Enable metrics if configured
    this.enabled = process.env.METRICS_ENABLED === 'true';

    if (this.enabled) {
      logger.info(MODULE_NAME, 'Metrics collection enabled');
    }
  }

  /**
   * Increment a counter
   *
   * @param name Metric name
   * @param value Amount to increment (default: 1)
   * @param labels Optional labels for metric dimensions
   */
  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const key = this.getKey(name, labels);
    const metric = this.metrics.get(key);

    if (metric) {
      if (metric.type !== MetricType.COUNTER) {
        logger.warn(MODULE_NAME, 'Metric type mismatch', { name, expected: MetricType.COUNTER, actual: metric.type });
        return;
      }
      metric.value += value;
    } else {
      this.metrics.set(key, {
        type: MetricType.COUNTER,
        value,
        labels,
      });
    }
  }

  /**
   * Set a gauge value
   *
   * @param name Metric name
   * @param value New value
   * @param labels Optional labels for metric dimensions
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const key = this.getKey(name, labels);
    const metric = this.metrics.get(key);

    if (metric) {
      if (metric.type !== MetricType.GAUGE) {
        logger.warn(MODULE_NAME, 'Metric type mismatch', { name, expected: MetricType.GAUGE, actual: metric.type });
        return;
      }
      metric.value = value;
    } else {
      this.metrics.set(key, {
        type: MetricType.GAUGE,
        value,
        labels,
      });
    }
  }

  /**
   * Increment a gauge
   *
   * @param name Metric name
   * @param value Amount to increment (can be negative)
   * @param labels Optional labels for metric dimensions
   */
  incrementGauge(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const key = this.getKey(name, labels);
    const metric = this.metrics.get(key);

    if (metric) {
      if (metric.type !== MetricType.GAUGE) {
        logger.warn(MODULE_NAME, 'Metric type mismatch', { name, expected: MetricType.GAUGE, actual: metric.type });
        return;
      }
      metric.value += value;
    } else {
      this.metrics.set(key, {
        type: MetricType.GAUGE,
        value,
        labels,
      });
    }
  }

  /**
   * Observe a value in a histogram
   *
   * @param name Metric name
   * @param value Value to observe
   * @param labels Optional labels for metric dimensions
   * @param buckets Histogram buckets (upper bounds)
   */
  observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ): void {
    if (!this.enabled) return;

    const key = this.getKey(name, labels);
    let metric = this.metrics.get(key) as Histogram | undefined;

    if (!metric) {
      // Create new histogram
      metric = {
        type: MetricType.HISTOGRAM,
        count: 0,
        sum: 0,
        buckets: new Map(),
        labels,
      };

      // Initialize buckets
      for (const bucket of buckets) {
        metric.buckets.set(bucket, 0);
      }
      metric.buckets.set(Infinity, 0); // +Inf bucket

      this.metrics.set(key, metric);
    }

    if (metric.type !== MetricType.HISTOGRAM) {
      logger.warn(MODULE_NAME, 'Metric type mismatch', { name, expected: MetricType.HISTOGRAM, actual: metric.type });
      return;
    }

    // Update histogram
    metric.count++;
    metric.sum += value;

    // Update buckets
    for (const [bucket, count] of metric.buckets.entries()) {
      if (value <= bucket) {
        metric.buckets.set(bucket, count + 1);
      }
    }
  }

  /**
   * Get all metrics
   *
   * @returns Map of metric keys to metrics
   */
  getMetrics(): Map<string, Metric> {
    return new Map(this.metrics);
  }

  /**
   * Export metrics in Prometheus text format
   *
   * @returns Prometheus-formatted metrics string
   */
  exportPrometheus(): string {
    if (!this.enabled) {
      return '# Metrics collection is disabled\n';
    }

    const lines: string[] = [];
    const metricsByName = new Map<string, Array<[string, Metric]>>();

    // Group metrics by name (without labels)
    for (const [key, metric] of this.metrics.entries()) {
      const name = this.getNameFromKey(key);
      if (!metricsByName.has(name)) {
        metricsByName.set(name, []);
      }
      metricsByName.get(name)!.push([key, metric]);
    }

    // Export each metric
    for (const [name, metrics] of metricsByName.entries()) {
      const firstMetric = metrics[0][1];

      // Add TYPE and HELP
      lines.push(`# HELP ${name} ${this.getMetricHelp(name)}`);
      lines.push(`# TYPE ${name} ${this.getPrometheusType(firstMetric.type)}`);

      // Add metric values
      for (const [key, metric] of metrics) {
        const labelStr = this.formatLabels(metric.labels);

        if (metric.type === MetricType.COUNTER || metric.type === MetricType.GAUGE) {
          lines.push(`${name}${labelStr} ${metric.value}`);
        } else if (metric.type === MetricType.HISTOGRAM) {
          // Export histogram buckets
          for (const [bucket, count] of metric.buckets.entries()) {
            const bucketLabel = bucket === Infinity ? '+Inf' : bucket.toString();
            const bucketLabels = { ...metric.labels, le: bucketLabel };
            lines.push(`${name}_bucket${this.formatLabels(bucketLabels)} ${count}`);
          }
          lines.push(`${name}_sum${labelStr} ${metric.sum}`);
          lines.push(`${name}_count${labelStr} ${metric.count}`);
        }
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    logger.info(MODULE_NAME, 'Metrics reset');
  }

  /**
   * Get metric key with labels
   *
   * @param name Metric name
   * @param labels Labels
   * @returns Unique key for metric
   */
  private getKey(name: string, labels: Record<string, string>): string {
    const labelPairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return labelPairs ? `${name}{${labelPairs}}` : name;
  }

  /**
   * Extract metric name from key
   *
   * @param key Metric key
   * @returns Metric name
   */
  private getNameFromKey(key: string): string {
    const braceIndex = key.indexOf('{');
    return braceIndex > 0 ? key.substring(0, braceIndex) : key;
  }

  /**
   * Format labels for Prometheus
   *
   * @param labels Labels object
   * @returns Formatted label string
   */
  private formatLabels(labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) {
      return '';
    }

    const labelPairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `{${labelPairs}}`;
  }

  /**
   * Get Prometheus type string
   *
   * @param type Metric type
   * @returns Prometheus type string
   */
  private getPrometheusType(type: MetricType): string {
    switch (type) {
      case MetricType.COUNTER:
        return 'counter';
      case MetricType.GAUGE:
        return 'gauge';
      case MetricType.HISTOGRAM:
        return 'histogram';
    }
  }

  /**
   * Get help text for metric
   *
   * @param name Metric name
   * @returns Help text
   */
  private getMetricHelp(name: string): string {
    const helpTexts: Record<string, string> = {
      graphql_queries_total: 'Total number of GraphQL queries executed',
      rest_fallback_total: 'Total number of REST API fallbacks',
      query_duration_seconds: 'Query execution duration in seconds',
      github_rate_limit_remaining: 'Remaining GitHub API rate limit',
      cache_hits_total: 'Total number of cache hits',
      cache_misses_total: 'Total number of cache misses',
    };

    return helpTexts[name] || `Metric ${name}`;
  }
}

/**
 * Global metrics registry
 */
export const metrics = new MetricsRegistry();

/**
 * Performance measurement utilities
 */
export class PerformanceMark {
  private startTime: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
  }

  /**
   * End measurement and record to histogram
   *
   * @param labels Optional labels for the metric
   */
  end(labels: Record<string, string> = {}): number {
    const duration = (performance.now() - this.startTime) / 1000; // Convert to seconds
    metrics.observeHistogram('query_duration_seconds', duration, {
      operation: this.name,
      ...labels,
    });

    logger.debug(MODULE_NAME, 'Performance mark recorded', {
      operation: this.name,
      durationMs: Math.round(duration * 1000),
      ...labels,
    });

    return duration;
  }
}

/**
 * Create a performance mark
 *
 * @param name Operation name
 * @returns PerformanceMark instance
 */
export function mark(name: string): PerformanceMark {
  return new PerformanceMark(name);
}

/**
 * Convenience functions for common metrics
 */

export function recordGraphQLQuery(success: boolean, labels: Record<string, string> = {}): void {
  metrics.incrementCounter('graphql_queries_total', 1, {
    success: success.toString(),
    ...labels,
  });
}

export function recordRESTFallback(reason: string, labels: Record<string, string> = {}): void {
  metrics.incrementCounter('rest_fallback_total', 1, {
    reason,
    ...labels,
  });
}

export function setRateLimitRemaining(remaining: number, labels: Record<string, string> = {}): void {
  metrics.setGauge('github_rate_limit_remaining', remaining, labels);
}

export function recordCacheHit(labels: Record<string, string> = {}): void {
  metrics.incrementCounter('cache_hits_total', 1, labels);
}

export function recordCacheMiss(labels: Record<string, string> = {}): void {
  metrics.incrementCounter('cache_misses_total', 1, labels);
}