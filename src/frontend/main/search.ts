import { LinkHandler } from "./links";
import { getTextNodes } from "./utils";
import MiniSearch, { SearchResult } from "minisearch";

export enum SearchType
{
	Title = 1,
	Aliases = 2,
	Headers = 4,
	Tags = 8,
	Path = 16,
	Content = 32,
}

const allSearch = SearchType.Title | SearchType.Aliases | SearchType.Headers | SearchType.Tags | SearchType.Path | SearchType.Content;
const searchInputDebounceMs = 120;

export class Search
{
	private index: MiniSearch | undefined;
	private input: HTMLInputElement;
	private container: HTMLElement;
	private inputDebounceTimer: number | undefined;

	// only used when the file tree is not present
	private dedicatedSearchResultsList: HTMLElement;
	

	public search(query: string, type: SearchType = allSearch)
	{
		if (!this.index) return;

		if (query.length == 0)
		{
			this.clear();
			return;
		}

		this.input.value = query;

		if (type != allSearch)
		{
			this.input.style.color = "var(--text-accent)";
		}
		else
		{
			this.input.style.color = "";
		}

		const searchFields: string[] = [];
		if (type & SearchType.Title) searchFields.push('title');
		if (type & SearchType.Aliases) searchFields.push('aliases');
		if (type & SearchType.Headers) searchFields.push('headers');
		if (type & SearchType.Tags) searchFields.push('tags');
		if (type & SearchType.Path) searchFields.push('path');
		if (type & SearchType.Content) searchFields.push('content');
		
		const results: Array<SearchResult> = this.index.search(query, 
		{ 
			prefix: true, 
			fuzzy: 0.2, 
			boost: { title: 2, aliases: 1.8, headers: 1.5, tags: 1.3, path: 1.1 }, 
			fields: searchFields 
		});

		// clamp results to at most the top 50
		if (results.length > 50) results.splice(50);
		
		// filter results for the best matches and generate extra metadata
		const topScore = results[0]?.score ?? 0;
		const showPaths: string[] = [];
		const headerLinks: Map<string, string[]> = new Map();
		for (const result of results)
		{
			// only show the most relevant results
			if (topScore > 0 && ((result.score < topScore * 0.30 && showPaths.length > 4) || result.score < topScore * 0.1)) 
				break;

			showPaths.push(result.path);

			// generate matching header links to display under the search result
			if(query.length > 2)
			{
				const headers: string[] = [];
				let breakEarly = false;
				for (const match in result.match)
				{
					if (result.match[match].includes("headers"))
					{
						for (const header of result.headers)
						{
							if (header.toLowerCase().includes(match.toLowerCase()))
							{
								if (!headers.includes(header)) headers.push(header);
								if (query.toLowerCase() != match.toLowerCase()) 
								{
									breakEarly = true;
									break;
								}
							}
						}
					}

					if (breakEarly) break;
				}

				headerLinks.set(result.path, headers);
			}
		}

		ObsidianSite.fileTree?.filter(showPaths);
		ObsidianSite.fileTree?.setSubHeadings(headerLinks);
		const pathRanks = new Map(showPaths.map((path, index) => [path, index]));
		ObsidianSite.fileTree?.sort((a, b) =>
		{
			if (!a || !b) return 0;
			return (pathRanks.get(a.path) ?? Number.MAX_SAFE_INTEGER) - (pathRanks.get(b.path) ?? Number.MAX_SAFE_INTEGER);
		});

		if (!ObsidianSite.fileTree)
		{
			const list = document.createElement('div');
			results.filter((result: any) => result.path.endsWith(".html"))
					.slice(0, 20).forEach((result: any) => 
					{
						const item = document.createElement('div');
						item.classList.add('search-result');

						const link = document.createElement('a');
						link.classList.add('tree-item-self');

						const searchURL = result.path + '?mark=' + encodeURIComponent(query);
						link.setAttribute('href', searchURL);
						link.appendChild(document.createTextNode(result.title));
						item.appendChild(link);
						list.append(item);
					});

			this.dedicatedSearchResultsList.replaceChildren(list);
			this.container.after(this.dedicatedSearchResultsList);
			LinkHandler.initializeLinks(this.dedicatedSearchResultsList);
		}
	
	}

	private async ensureIndexLoaded(): Promise<boolean>
	{
		if (this.index) return true;

		const index = await ObsidianSite.getSearchIndex();
		if (!index)
		{
			console.error("Failed to load shared search index");
			return false;
		}

		this.index = index;
		return true;
	}

	public async searchParseFilters(queryString: string)
	{
		if (!(await this.ensureIndexLoaded())) return;

		if (queryString.startsWith("?")) queryString = queryString.substring(1);
		let filterName = queryString.split(":")[0];
		if (!queryString.includes(":")) filterName = "";

		if (filterName == "content" || filterName == "text" || filterName == "body")
		{
			this.search(queryString, SearchType.Content);
		}
		else if (filterName == "title" || filterName == "name")
		{
			this.search(queryString, SearchType.Title);
		}
		else if (filterName == "path")
		{
			this.search(queryString, SearchType.Path);
		}
		else if (filterName == "header" || filterName == "headers")
		{
			this.search(queryString, SearchType.Headers);
		}
		else if (filterName == "tag" || filterName == "tags" || queryString.startsWith("#"))
		{
			this.search(queryString, SearchType.Tags);
		}
		else if (filterName == "alias" || filterName == "aliases")
		{
			this.search(queryString, SearchType.Aliases);
		}
		else
		{
			this.search(queryString);
		}
	}

	public clear()
	{
		if (this.inputDebounceTimer != undefined)
		{
			clearTimeout(this.inputDebounceTimer);
			this.inputDebounceTimer = undefined;
		}

		this.container?.classList.remove("has-content");
		this.input.value = "";
		this.clearCurrentDocumentSearch();
		ObsidianSite.fileTree?.unfilter();
		ObsidianSite.fileTree?.removeSubHeadings();
		ObsidianSite.fileTree?.unsort();
	}

	public async init(preloadedIndexJSON?: any): Promise<Search | undefined>
	{
		this.input = document.querySelector('input[type="search"]') as HTMLInputElement;
		this.container = this.input?.closest("#search-container") as HTMLElement;
		if (!this.input || !this.container) return;

		if (preloadedIndexJSON instanceof MiniSearch)
		{
			this.index = preloadedIndexJSON;
		}

		const inputClear = document.querySelector('#search-clear-button');
		inputClear?.addEventListener('click', (event) => 
		{
			this.clear();
		});

		this.input.addEventListener('focus', () =>
		{
			void this.ensureIndexLoaded();
		});

		this.input.addEventListener('input', (event) => 
		{
			const query = (event.target as HTMLInputElement)?.value ?? "";
			if (query.length == 0)
			{
				this.clear();
				return;
			}

			if (this.inputDebounceTimer != undefined)
			{
				clearTimeout(this.inputDebounceTimer);
			}

			this.inputDebounceTimer = window.setTimeout(() =>
			{
				this.inputDebounceTimer = undefined;
				if (this.input.value !== query) return;
				void this.searchParseFilters(query);
			}, searchInputDebounceMs);
		});

		if (!ObsidianSite.fileTree)
		{
			this.dedicatedSearchResultsList = document.createElement('div');
			this.dedicatedSearchResultsList.setAttribute('id', 'search-results');
		}

		return this;
	}

	private async searchCurrentDocument(query: string)
	{
		this.clearCurrentDocumentSearch();
		const textNodes = getTextNodes(ObsidianSite.document.sizerEl ?? ObsidianSite.document.documentEl);

		textNodes.forEach(async (node) =>
		{
			const content = node.nodeValue;
			const newContent = content?.replace(new RegExp(query, 'gi'), match => `<mark>${match}</mark>`);

			if (newContent && newContent !== content) 
			{
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = newContent;
		
				const newNodes = Array.from(tempDiv.childNodes);
		
				newNodes.forEach(newNode => 
				{
					if (newNode.nodeType != Node.TEXT_NODE)
					{
						(newNode as Element)?.setAttribute('class', 'search-mark');
					}
					node?.parentNode?.insertBefore(newNode, node);
				});
		
				node?.parentNode?.removeChild(node);
			}
		});

		const firstMark = document.querySelector(".search-mark");

		// wait for page to fade in
		setTimeout(() => 
		{
			if(firstMark) ObsidianSite.scrollTo(firstMark);
		}, 500);
	}

	private clearCurrentDocumentSearch()
	{
		document.querySelectorAll(".search-mark").forEach(node => 
		{
			node.outerHTML = node.innerHTML;
		});
	}
}
