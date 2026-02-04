#[cfg(feature = "lancedb")]
#[tokio::test]
async fn test_lancedb_embedded() {
    use plexus_ai::{LanceDbStore, VectorStore};
    use tempfile::Builder;

    // Create a temporary directory for the embedded DB
    let temp_dir = Builder::new()
        .prefix("plexus_lance_test")
        .tempdir()
        .unwrap();
    let db_path = temp_dir.path().join("vectors.lance");

    // Initialize Store
    let store = LanceDbStore::new(&db_path)
        .await
        .expect("Failed to create LanceDbStore");

    // Add Document
    let id = "doc1";
    let text = "Hello world";
    let vector = vec![0.1; 384]; // Mock 384-dim vector

    store
        .add_document(id, text, vector.clone())
        .await
        .expect("Failed to add document");

    // Search
    let query = vec![0.1; 384];
    let results = store.search(query, 1).await.expect("Failed to search");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].0, text);
    // Similarity should be close to 1.0 (since dist is 0.0)
    assert!(results[0].1 > 0.99);
}
