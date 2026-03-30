#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn test_add_liquidity_and_swap() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PoolContract, ());
    let client = PoolContractClient::new(&env, &contract_id);
    let token_a = Address::generate(&env);
    let token_b = Address::generate(&env);
    let provider = Address::generate(&env);
    let trader = Address::generate(&env);
    client.initialize(&token_a, &token_b);
    let shares = client.add_liq(&provider, &10000, &10000);
    assert!(shares > 0);
    let (ra, rb) = client.get_reserves();
    assert_eq!(ra, 10000);
    assert_eq!(rb, 10000);
    let expected_out = client.quote(&1000);
    assert!(expected_out > 0);
    let actual_out = client.swap_a_b(&trader, &1000);
    assert_eq!(actual_out, expected_out);
}

#[test]
fn test_amm_invariant() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PoolContract, ());
    let client = PoolContractClient::new(&env, &contract_id);
    let token_a = Address::generate(&env);
    let token_b = Address::generate(&env);
    let provider = Address::generate(&env);
    let trader = Address::generate(&env);
    client.initialize(&token_a, &token_b);
    client.add_liq(&provider, &100000, &100000);
    let (ra_before, rb_before) = client.get_reserves();
    let k_before = ra_before * rb_before;
    client.swap_a_b(&trader, &5000);
    let (ra_after, rb_after) = client.get_reserves();
    let k_after = ra_after * rb_after;
    assert!(k_after >= k_before);
}