import React, {useCallback, useEffect, useState, useImperativeHandle, useReducer, forwardRef} from 'react';
import type {WidgetConfig} from './configuration/config';
import Config from './configuration/config';
import Content from './content/content';
import ConfigurableWidget from '../hub-widget-ui/configurable-widget/configurable-widget';
import useRefreshTimer from '../hub-widget-ui/timer/timer/useRefreshTimer';
import type {DocumentListTab} from '../hooks/useTabsManager';
import {useWidgetContext} from '../widget-context';
import {i18n} from '@jetbrains/youtrack-apps-tools/dist/lib/i18n/i18n';
import alertService from '@jetbrains/ring-ui-built/components/alert-service/alert-service';

const DEFAULT_REFRESH_PERIOD_SEC = 600;

export interface WidgetRef {
    enterConfigMode: () => void;
    refreshWidget: () => void;
}

interface YTConfig {
    title?: string;
    tabsConfig: string;
    refreshPeriod: number;
}

const DocumentsListWidget = forwardRef<WidgetRef, object>((_props, ref) => {
    const {dashboardApi} = useWidgetContext();

    const [config, setConfig] = useState<WidgetConfig>({
        tabs: [],
        refreshPeriod: DEFAULT_REFRESH_PERIOD_SEC,
    });
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshKey, forceRefresh] = useReducer(x => x + 1, 0);

    const toWidgetConfig = (ytConfig: YTConfig): WidgetConfig => ({
        title: ytConfig.title,
        tabs: JSON.parse(ytConfig.tabsConfig) as DocumentListTab[],
        refreshPeriod: ytConfig.refreshPeriod,
    });

    const toYTConfig = useCallback((widgetConfig: WidgetConfig): YTConfig => ({
        title: widgetConfig.title?.trim(),
        tabsConfig: JSON.stringify(widgetConfig.tabs),
        refreshPeriod: widgetConfig.refreshPeriod,
    }), []);

    const loadConfig = useCallback(async (): Promise<WidgetConfig | null> => {
        const storedConfig = await dashboardApi.readConfig<YTConfig>();
        if (!storedConfig?.tabsConfig) {
          return null;
        }
        return toWidgetConfig(storedConfig);
    }, [dashboardApi]);

    const saveConfig = useCallback(
        async (widgetConfig: WidgetConfig): Promise<void> => {
            await dashboardApi.storeConfig(toYTConfig(widgetConfig));
            setConfig(widgetConfig);

            if (widgetConfig.title) {
                await dashboardApi.setTitle(widgetConfig.title, '');
            }
        },
        [dashboardApi, toYTConfig],
    );

    useRefreshTimer({
        onTick: forceRefresh,
      // eslint-disable-next-line no-magic-numbers
        tickPeriod: (config.refreshPeriod ?? DEFAULT_REFRESH_PERIOD_SEC) * 1000,
    });

    useImperativeHandle(
        ref,
        () => ({
            enterConfigMode: () => setIsConfiguring(true),
            refreshWidget: () => forceRefresh(),
        }),
        [],
    );

    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            try {
                const configuration = await loadConfig();
                if (configuration) {
                    setConfig(configuration);
                } else {
                    setIsConfiguring(true);
                }
            } catch (e: unknown) {
                alertService.error(e instanceof Error ? e.message : 'Failed to load widget configuration');
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, [dashboardApi, loadConfig]);

    const onConfigSubmit = useCallback(
        async (newConfig: WidgetConfig) => {
            setIsLoading(true);

            await dashboardApi.clearError();
            await saveConfig(newConfig);
            setIsConfiguring(false);

            setIsLoading(false);
        },
        [dashboardApi, saveConfig],
    );

    const onConfigCancel = useCallback(async () => {
        setIsConfiguring(false);
        const configuration = await loadConfig();
        if (configuration) {
            setConfig(configuration);
        } else {
            dashboardApi.removeWidget();
        }
    }, [dashboardApi, loadConfig]);

    const widgetTitle = isConfiguring ? i18n('Documents List') : config.title;

    const Configuration = useCallback(
        () => (
          <Config
            title={config.title}
            tabs={config.tabs}
            refreshPeriod={config.refreshPeriod}
            isLoading={isLoading}
            onSubmit={onConfigSubmit}
            onCancel={onConfigCancel}
          />
        ),
        [isLoading, onConfigCancel, onConfigSubmit, config.title, config.tabs, config.refreshPeriod],
    );

    const widgetContent = useCallback(
        () => <Content key={refreshKey} tabs={config.tabs} editable onEdit={() => setIsConfiguring(true)}/>,
        [refreshKey, config.tabs],
    );

    return (
      <ConfigurableWidget
        isConfiguring={isConfiguring}
        dashboardApi={dashboardApi}
        widgetTitle={widgetTitle}
        Configuration={Configuration}
        Content={widgetContent}
      />
    );
});

DocumentsListWidget.displayName = 'DocumentsListWidget';

export default DocumentsListWidget;
