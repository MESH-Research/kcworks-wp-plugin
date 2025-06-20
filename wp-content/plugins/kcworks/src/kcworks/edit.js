/**
 * Retrieves the translation of text.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
 */
import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useState } from '@wordpress/element';

/**
 * React hook that is used to mark the block wrapper element.
 * It provides all the necessary props like the class name.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
 */
import { useBlockProps } from '@wordpress/block-editor';

/**
 * Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
 * Those files can contain any CSS code that gets applied to the editor.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './editor.scss';
import { Card, CardBody } from '@wordpress/components';
import DataBlockInspectorControls from './components/DataBlockInspectorControls.js';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { getItems, sortItems } from './processdata.js';
import CSL from 'citeproc';
import locales from './locales/locales.json';

const pluginBaseUrl = '/wp-content/plugins/kcworks/src/kcworks';

/**
 * @param {string} styleId
 * @returns
 */
function getCslFileStyle( styleId ) {
	if ( styleId === null ) {
		return '';
	}
	const xhr = new XMLHttpRequest();
	xhr.open( 'GET', `${ pluginBaseUrl }/styles/${ styleId }.csl`, false );
	xhr.send( null );
	const text = xhr.responseText;
	const parser = new DOMParser();
	return parser.parseFromString( text, 'text/xml' );
}

/**
 * @param {string} localeId
 * @returns
 */
function getXmlFileLocale( localeId ) {
	if ( localeId === null ) {
		return null;
	}
	const xhr = new XMLHttpRequest();
	xhr.open(
		'GET',
		`${ pluginBaseUrl }/locales/locales-${ localeId }.xml`,
		false
	);
	xhr.send( null );
	return xhr.responseText;
}

/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 *
 * @return {Element} Element to render.
 */
export default function Edit( { attributes, setAttributes } ) {
	const { kcworksQuery, validatedKcworksQuery } = attributes;
	const [ dataFetched, setDataFetched ] = useState( false );
	const [ results, setResults ] = useState( [] );
	const [ invalidQuery, setInvalidQuery ] = useState( false );
	const [ loading, setLoading ] = useState( true );
	const [ fetchError, setFetchError ] = useState( false );
	const [ styleSetting, setStyleSetting ] = useState( 'apa' );
	const [ localeSetting, setLocaleSetting ] = useState( 'en-US' );
	const [ sortSetting, setSortSetting ] = useState( 'newest' );
	const [ bibliography, setBibliography ] = useState( '<p>...</p>' );

	const fetchData = useCallback( async () => {
		setFetchError( false );
		setDataFetched( false );

		const queryParams = { kcworksQuery: `${ kcworksQuery }` };
		apiFetch( {
			path: addQueryArgs(
				'/mesh_research_kcworks/v1/kcworks-proxy',
				queryParams
			),
		} )
			.then( ( data ) => {
				setDataFetched( true );
				let a = sortItems( getItems( data ) );
				setResults( a );
			} )
			.catch( ( error ) => {
				console.error( error );
				setFetchError( true );
			} )
			.finally( () => {
				setLoading( false );
			} );
	}, [ kcworksQuery ] );

	useEffect( () => {
		if ( kcworksQuery && validatedKcworksQuery && ! dataFetched ) {
			fetchData();
		}
		if ( ! kcworksQuery ) {
			setLoading( false );
		}
	}, [ kcworksQuery, validatedKcworksQuery, dataFetched, fetchData ] );

	function generateBibliography( data ) {
		const sys = {
			retrieveLocale: ( locale ) => {
				if ( Object.hasOwn( locales[ 'primary-dialects' ], locale ) ) {
					setLocaleSetting( locale );
					return getXmlFileLocale( locale );
				} else {
					return getXmlFileLocale( 'en-US' );
				}
			},
			retrieveItem: ( itemId ) => {
				return data.find( ( item ) => item.id === itemId );
			},
		};

		const s = new XMLSerializer();
		const style = s.serializeToString( getCslFileStyle( styleSetting ) );
		const citeproc = new CSL.Engine( sys, style );
		const orcidItemIds = data.map( ( item ) => item.id );
		citeproc.updateItems( orcidItemIds );
		const bibliography = citeproc.makeBibliography();
		setBibliography( bibliography[ 1 ].join( '\n' ) );
	}

	useEffect( () => {
		if ( results.length > 0 ) {
			generateBibliography( results );
		}
	}, [ results, styleSetting, sortSetting, localeSetting ] );

	function buttonHandler() {
		setLoading( true );
		const verification = true; // verifyKcworksQuery( kcworksQuery );
		setAttributes( { validatedKcworksQuery: true } );
		if ( ! verification ) {
			setInvalidQuery( true );
			setLoading( false );
		} else {
			setInvalidQuery( false );
			fetchData();
		}
	}

	return (
		<>
			<DataBlockInspectorControls
				kcworksQuery={ kcworksQuery }
				invalidQuery={ invalidQuery }
				setInvalidQuery={ setInvalidQuery }
				buttonHandler={ buttonHandler }
				loading={ loading }
				setAttributes={ setAttributes }
				styleSetting={ styleSetting }
				setStyleSetting={ setStyleSetting }
				sortSetting={ sortSetting }
				setSortSetting={ setSortSetting }
			/>
			<div { ...useBlockProps() }>
				{ fetchError && (
					<div role="alert">
						<Card>
							<CardBody>
								<p>
									{ __(
										'An error occurred while fetching the data from KCWorks',
										'kcworks'
									) }
								</p>
							</CardBody>
						</Card>
					</div>
				) }
				<p>Welcome to KCWorks</p>
				{ dataFetched && (
					<section className="kcworks-bibliography">
						{
							<div
								dangerouslySetInnerHTML={ {
									__html: bibliography,
								} }
							/>
						}
					</section>
				) }
			</div>
		</>
	);
}
